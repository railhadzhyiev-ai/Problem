enum GermanGrammaticalGender {
  masculine,
  feminine,
  neuter,
}

GermanGrammaticalGender? parseGermanGrammaticalGender(Object? raw) {
  final value = raw?.toString().trim().toLowerCase();
  return switch (value) {
    'm' || 'masculine' || 'maskulin' || 'der' =>
      GermanGrammaticalGender.masculine,
    'f' || 'feminine' || 'feminin' || 'die' =>
      GermanGrammaticalGender.feminine,
    'n' || 'neuter' || 'neutral' || 'neutrum' || 'das' =>
      GermanGrammaticalGender.neuter,
    _ => null,
  };
}

/// Compatibility fallback for the current word payload where singular nouns may
/// expose only their article. Explicit grammatical-gender data always wins.
GermanGrammaticalGender? germanGenderFromArticle(String? article) {
  final value = article?.trim().toLowerCase();
  return switch (value) {
    'der' => GermanGrammaticalGender.masculine,
    'die' => GermanGrammaticalGender.feminine,
    'das' => GermanGrammaticalGender.neuter,
    _ => null,
  };
}
