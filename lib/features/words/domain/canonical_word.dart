import 'grammatical_gender.dart';

enum TargetLanguage { de, en, es, it, fr }

String targetLanguageCode(TargetLanguage value) => value.name;

TargetLanguage parseTargetLanguage(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('target_language_required');
  }
  return TargetLanguage.values.firstWhere(
    (candidate) => candidate.name == value,
    orElse: () => throw const FormatException('target_language_unavailable'),
  );
}

/// Stable lexical identity is issued by the canonical store, never by spelling.
final class WordId {
  WordId(String value) : value = _requiredId(value, 'word_id');
  final String value;
  @override
  bool operator ==(Object other) => other is WordId && other.value == value;
  @override
  int get hashCode => value.hashCode;
}

final class SenseId {
  SenseId(String value) : value = _requiredId(value, 'sense_id');
  final String value;
  @override
  bool operator ==(Object other) => other is SenseId && other.value == value;
  @override
  int get hashCode => value.hashCode;
}

String _requiredId(String value, String field) {
  if (value.trim().toLowerCase().startsWith('staging:')) {
    throw const FormatException('staging_identity_forbidden');
  }
  if (value.trim().isEmpty || value != value.trim()) {
    throw FormatException('$field must be non-empty and stable');
  }
  return value;
}

/// A sense reference isolates learning state where meanings differ materially.
final class LearningTarget {
  const LearningTarget(this.wordId, [this.senseId]);
  final WordId wordId;
  final SenseId? senseId;
  @override
  bool operator ==(Object other) =>
      other is LearningTarget &&
      other.wordId == wordId &&
      other.senseId == senseId;
  @override
  int get hashCode => Object.hash(wordId, senseId);
}

final class WordSense {
  const WordSense({required this.id, required this.germanGloss});
  final SenseId id;
  final String germanGloss;
}

/// German lexical facts exist once regardless of learner locale or app surface.
final class CanonicalGermanWord {
  CanonicalGermanWord({
    required this.id,
    required this.lemma,
    required this.partOfSpeech,
    this.article,
    this.plural,
    this.cefr,
    this.ipa,
    this.germanExamples = const [],
    this.grammar = const {},
    this.provenance = const {},
    this.senses = const [],
    this.lookupForms = const [],
  }) {
    if (lemma.trim().isEmpty || partOfSpeech.trim().isEmpty) {
      throw const FormatException(
          'German lemma and part of speech are required');
    }
    if (cefr != null &&
        !const {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}.contains(cefr)) {
      throw const FormatException('Unsupported CEFR level');
    }
    if (senses.map((s) => s.id).toSet().length != senses.length) {
      throw const FormatException('Duplicate sense_id under word_id');
    }
  }

  TargetLanguage get targetLanguage => TargetLanguage.de;

  final WordId id;
  final String lemma;
  final String partOfSpeech;
  final String? article;
  final String? plural;
  final String? cefr;
  final String? ipa;
  final List<String> germanExamples;
  final Map<String, Object?> grammar;
  final Map<String, Object?> provenance;
  final List<WordSense> senses;

  /// Surface, alias and inflected forms only resolve to IDs; they are not IDs.
  final List<String> lookupForms;

  GermanGrammaticalGender? get grammaticalGender {
    final explicit = parseGermanGrammaticalGender(
      grammar['grammatical_gender'] ?? grammar['gender'],
    );
    return explicit ?? germanGenderFromArticle(article);
  }

  LearningTarget targetFor(SenseId? senseId) {
    if (senseId != null && !senses.any((s) => s.id == senseId)) {
      throw const FormatException('sense_id does not belong to word_id');
    }
    return LearningTarget(id, senseId);
  }

  /// Prevent a lexeme-level mastery event from implicitly mastering all senses.
  LearningTarget masteryTargetFor(SenseId? senseId) {
    if (senses.isNotEmpty && senseId == null) {
      throw const FormatException('sense_id required for sense-level mastery');
    }
    return targetFor(senseId);
  }
}

final class WordLocalization {
  WordLocalization({
    required this.wordId,
    required this.locale,
    required this.translation,
    this.senseId,
    this.pronunciationHint,
    this.explanation,
    this.exampleTranslations = const [],
  }) {
    if (!supportedLearnerLocales.contains(locale)) {
      throw const FormatException('Unsupported learner locale');
    }
    if (translation.trim().isEmpty) {
      throw const FormatException('Localization requires translation');
    }
  }
  final WordId wordId;
  final SenseId? senseId;
  final String locale;
  final String translation;
  final String? pronunciationHint;
  final String? explanation;
  final List<String> exampleTranslations;
  LearningTarget get target => LearningTarget(wordId, senseId);
}

const supportedLearnerLocales = {'ru', 'uk', 'az', 'ro', 'tr', 'ar'};
const firstReleaseEnabledLocales = {'ru', 'uk', 'az'};

enum LocalizationState { available, localizationMissing }

final class LocalizationResult {
  const LocalizationResult.available(this.value)
      : state = LocalizationState.available;
  const LocalizationResult.missing()
      : value = null,
        state = LocalizationState.localizationMissing;
  final String? value;
  final LocalizationState state;
}

LocalizationResult localizationFor(
  Iterable<WordLocalization> records,
  LearningTarget target,
  String locale,
) {
  for (final record in records) {
    if (record.target == target && record.locale == locale) {
      return LocalizationResult.available(record.translation);
    }
  }
  return const LocalizationResult.missing();
}

final class LookupCandidate {
  const LookupCandidate(this.wordId, this.targetLanguage, [this.senseId]);
  final WordId wordId;
  final TargetLanguage targetLanguage;
  final SenseId? senseId;
  LearningTarget get target => LearningTarget(wordId, senseId);
}

/// One search string may resolve to multiple lexical candidates.
final class WordLookupResult {
  const WordLookupResult({required this.query, required this.targetLanguage, required this.candidates});
  final String query;
  final TargetLanguage targetLanguage;
  final List<LookupCandidate> candidates;
  bool get isAmbiguous => candidates.length > 1;
}
