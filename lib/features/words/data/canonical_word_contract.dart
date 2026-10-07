import '../domain/canonical_word.dart';

/// First V2 canonical wire version. Unversioned V1 is handled by WordEntry.
const currentWordSchemaVersion = 2;

final class UnsupportedWordSchemaVersion implements Exception {
  const UnsupportedWordSchemaVersion(this.version);
  final Object? version;
  @override
  String toString() => 'UnsupportedWordSchemaVersion($version)';
}

final class CanonicalWordEnvelope {
  const CanonicalWordEnvelope({
    required this.word,
    required this.localizations,
  });
  final CanonicalGermanWord word;
  final List<WordLocalization> localizations;

  factory CanonicalWordEnvelope.fromJson(Map<String, dynamic> json) {
    if (json['schemaVersion'] != currentWordSchemaVersion) {
      throw UnsupportedWordSchemaVersion(json['schemaVersion']);
    }
    final rawWord = json['word'];
    if (rawWord is! Map) {
      throw const FormatException('Canonical word object is required');
    }
    final word = Map<String, dynamic>.from(rawWord);
    final id = WordId(_requiredString(word, 'word_id'));
    final rawSenses = word['senses'];
    final senses = <WordSense>[];
    if (rawSenses is List) {
      for (final item in rawSenses) {
        if (item is! Map) throw const FormatException('Invalid sense');
        final sense = Map<String, dynamic>.from(item);
        senses.add(WordSense(
          id: SenseId(_requiredString(sense, 'sense_id')),
          germanGloss: _requiredString(sense, 'german_gloss'),
        ));
      }
    }
    final targetLanguage = parseTargetLanguage(word['target_language']);
    if (targetLanguage != TargetLanguage.de) {
      throw const FormatException('German payload target_language_mismatch');
    }
    final canonical = CanonicalGermanWord(
      id: id,
      lemma: _requiredString(word, 'lemma'),
      partOfSpeech: _requiredString(word, 'part_of_speech'),
      article: _optionalString(word, 'article'),
      plural: _optionalString(word, 'plural'),
      cefr: _optionalString(word, 'cefr'),
      ipa: _optionalString(word, 'ipa'),
      germanExamples: List.unmodifiable(_stringList(word['german_examples'])),
      grammar: Map.unmodifiable(_objectMap(word['grammar'])),
      provenance: Map.unmodifiable(_objectMap(word['provenance'])),
      senses: List.unmodifiable(senses),
      lookupForms: List.unmodifiable(_stringList(word['lookup_forms'])),
    );
    final rawLocalizations = json['localizations'];
    final localizations = <WordLocalization>[];
    if (rawLocalizations is List) {
      for (final item in rawLocalizations) {
        if (item is! Map) throw const FormatException('Invalid localization');
        final record = Map<String, dynamic>.from(item);
        final localizationWordId = WordId(_requiredString(record, 'word_id'));
        if (localizationWordId != id) {
          throw const FormatException('Localization word_id mismatch');
        }
        final senseId = _optionalString(record, 'sense_id');
        final parsedSenseId = senseId == null ? null : SenseId(senseId);
        canonical.targetFor(parsedSenseId);
        localizations.add(WordLocalization(
          wordId: id,
          senseId: parsedSenseId,
          locale: _requiredString(record, 'locale'),
          translation: _requiredString(record, 'translation'),
          pronunciationHint: _optionalString(record, 'pronunciation_hint'),
          explanation: _optionalString(record, 'explanation'),
          exampleTranslations:
              List.unmodifiable(_stringList(record['example_translations'])),
        ));
      }
    }
    final keys = localizations
        .map((r) => '${r.wordId.value}|${r.senseId?.value ?? ''}|${r.locale}')
        .toList();
    if (keys.toSet().length != keys.length) {
      throw const FormatException('Duplicate localization identity and locale');
    }
    return CanonicalWordEnvelope(
      word: canonical,
      localizations: List.unmodifiable(localizations),
    );
  }
}

final class CanonicalLookupEnvelope {
  const CanonicalLookupEnvelope(this.result);
  final WordLookupResult result;

  factory CanonicalLookupEnvelope.fromJson(Map<String, dynamic> json) {
    if (json['schemaVersion'] != currentWordSchemaVersion) {
      throw UnsupportedWordSchemaVersion(json['schemaVersion']);
    }
    final query = _requiredString(json, 'query');
    final targetLanguage = parseTargetLanguage(json['target_language']);
    final rawCandidates = json['candidates'];
    if (rawCandidates is! List) {
      throw const FormatException('Lookup candidates must be a list');
    }
    final candidates = <LookupCandidate>[];
    for (final item in rawCandidates) {
      if (item is! Map) throw const FormatException('Invalid candidate');
      final candidate = Map<String, dynamic>.from(item);
      final sense = candidate['sense_id'] == null
          ? null
          : _stableIdentity(candidate['sense_id']);
      candidates.add(LookupCandidate(
        WordId(_stableIdentity(candidate['word_id'])),
        parseTargetLanguage(candidate['target_language']),
        sense == null ? null : SenseId(sense),
      ));
    }
    final targets = candidates.map((c) => c.target).toList();
    if (targets.toSet().length != targets.length) {
      throw const FormatException('Duplicate lookup candidate');
    }
    if (candidates
        .any((candidate) => candidate.targetLanguage != targetLanguage)) {
      throw const FormatException('target_language_mismatch');
    }
    return CanonicalLookupEnvelope(WordLookupResult(
      query: query,
      targetLanguage: targetLanguage,
      candidates: List.unmodifiable(candidates),
    ));
  }

  WordLookupResult resultFor(TargetLanguage requested) {
    if (result.targetLanguage != requested) {
      throw const FormatException('target_language_mismatch');
    }
    return result;
  }
}

String _stableIdentity(Object? value) {
  if (value is! String || value.isEmpty || value != value.trim()) {
    throw const FormatException('invalid_canonical_identity');
  }
  return value;
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = _optionalString(json, key);
  if (value == null) throw FormatException('$key is required');
  return value;
}

String? _optionalString(Map<String, dynamic> json, String key) {
  final raw = json[key];
  if (raw is! String) return null;
  final value = raw.trim();
  return value.isEmpty ? null : value;
}

List<String> _stringList(Object? raw) {
  if (raw == null) return const [];
  if (raw is! List) throw const FormatException('lookup_forms must be a list');
  final values = <String>[];
  for (final item in raw) {
    if (item is! String || item.trim().isEmpty) {
      throw const FormatException('Invalid lookup form');
    }
    values.add(item.trim());
  }
  return values;
}

Map<String, Object?> _objectMap(Object? raw) {
  if (raw == null) return const {};
  if (raw is! Map) throw const FormatException('Expected object map');
  return Map<String, Object?>.from(raw);
}
