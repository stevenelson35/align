<?php
require __DIR__ . '/../../scripts/wordle/wordle-api.php';

function expectHardMode($answer, $previous, $guess, $expected) {
    $rows = array_map(static fn($word) => ['word' => $word, 'marks' => wordleMarks($answer, $word)], $previous);
    $actual = hardModeError($rows, $guess);
    if ($expected === null ? $actual !== null : !is_string($actual) || !str_contains($actual, $expected)) {
        throw new RuntimeException("Unexpected hard-mode result for $guess: " . var_export($actual, true));
    }
}

expectHardMode('CIGAR', ['SLATE'], 'CIARS', null);
expectHardMode('CIGAR', ['SLATE'], 'CIGRS', 'Use at least 1 A');
expectHardMode('CRISP', ['CRANE'], 'XRATE', 'Keep C in position 1');
expectHardMode('LABEL', ['ALLOT'], 'LABLE', null);
expectHardMode('LABEL', ['ALLOT'], 'LACED', 'Use at least 2 Ls');
expectHardMode('CRISP', ['CRANE', 'CRATE'], 'CRISP', null);
echo "Wordle PHP hard-mode checks passed.\n";
