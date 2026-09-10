/// Builds the four sample question workbooks (LOG, NUM, OUT, STP).
///
/// These sections have no client source file. The questions here are authored
/// in-house so the full seven-section paper can be generated and tested end to
/// end; they are NOT client content and are marked as such in two ways:
///
///   * every id carries a `-T` block (LOG-T0001), and
///   * every topic is prefixed `[SAMPLE]`.
///
/// Both are greppable, and the whole set is removable with a single statement:
///
///   DELETE FROM questions WHERE id LIKE '%-T%';
///
/// Column layout matches the client files exactly (24 columns), so these import
/// through the same flexible importer with no special handling. The four extra
/// columns beyond the 16-field contract are ignored on import, as they are for
/// the client files.
///
/// Difficulty is 18 easy / 6 medium / 6 hard per section — the configured
/// 60/20/20 mix — so the allocator never has to clamp.
///
/// Run: node sample-questions/build-sample-questions.mjs

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as XLSX from "xlsx";

const HEADERS = [
  "id", "section", "topic", "difficulty", "question", "code_block", "verify_code",
  "option_a", "option_b", "option_c", "option_d", "correct", "explanation",
  "lesson_text", "lesson_group", "scored", "marks", "source_batch", "dupe_group",
  "machine_verified", "blind_agrees", "conflict_reason", "trainer_verified", "status",
];

/// [topic, difficulty, question, code_block, a, b, c, d, correct, explanation]
/// Written so the correct answer is spread across a/b/c/d rather than clustering.

const LOG = [
  ["Series", "easy", "What comes next: 2, 4, 6, 8, ?", "", "9", "10", "11", "12", "b", "The series increases by 2 each step, so 8 + 2 = 10."],
  ["Series", "easy", "What comes next: 5, 10, 15, 20, ?", "", "22", "24", "25", "30", "c", "The series increases by 5 each step, so 20 + 5 = 25."],
  ["Series", "easy", "What comes next: 1, 3, 5, 7, ?", "", "8", "9", "10", "11", "b", "These are consecutive odd numbers, so 7 + 2 = 9."],
  ["Series", "easy", "What comes next: 10, 20, 30, 40, ?", "", "45", "50", "55", "60", "b", "The series increases by 10 each step, so 40 + 10 = 50."],
  ["Series", "easy", "What comes next: 3, 6, 9, 12, ?", "", "14", "15", "16", "18", "b", "These are multiples of 3, so 12 + 3 = 15."],
  ["Odd one out", "easy", "Which number does not belong: 2, 4, 7, 8, 10?", "", "2", "4", "7", "10", "c", "Every other number is even; 7 is the only odd one."],
  ["Odd one out", "easy", "Which does not belong: circle, square, triangle, rectangle?", "", "circle", "square", "triangle", "rectangle", "a", "The others are all made of straight edges; a circle has none."],
  ["Odd one out", "easy", "Which number does not belong: 9, 16, 20, 25?", "", "9", "16", "20", "25", "c", "9, 16 and 25 are perfect squares; 20 is not."],
  ["Letter series", "easy", "What comes next: A, C, E, G, ?", "", "H", "I", "J", "K", "b", "The letters skip one each time, so G is followed by I."],
  ["Letter series", "easy", "What comes next: Z, Y, X, W, ?", "", "T", "U", "V", "S", "c", "The letters run backwards through the alphabet, so W is followed by V."],
  ["Patterns", "easy", "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are:", "", "Lazzies", "only Razzies", "neither", "cannot be determined", "a", "The relationship carries through: Bloops are Razzies, and Razzies are Lazzies."],
  ["Patterns", "easy", "What comes next: 1, 4, 9, 16, ?", "", "20", "24", "25", "36", "c", "These are the squares 1², 2², 3², 4², so the next is 5² = 25."],
  ["Patterns", "easy", "What comes next: 2, 4, 8, 16, ?", "", "18", "24", "30", "32", "d", "Each number doubles, so 16 × 2 = 32."],
  ["Counting", "easy", "How many times does the digit 7 appear from 1 to 30?", "", "2", "3", "4", "5", "b", "7, 17 and 27 — three occurrences."],
  ["Direction", "easy", "You face north and turn 90° clockwise. Which way do you face?", "", "south", "east", "west", "north", "b", "A 90° clockwise turn from north points east."],
  ["Series", "easy", "What comes next: 100, 90, 80, 70, ?", "", "50", "55", "60", "65", "c", "The series decreases by 10 each step, so 70 - 10 = 60."],
  ["Odd one out", "easy", "Which does not belong: dog, cat, horse, oak?", "", "dog", "cat", "horse", "oak", "d", "The others are animals; an oak is a tree."],
  ["Letter series", "easy", "What comes next: B, D, F, H, ?", "", "I", "J", "K", "L", "b", "The letters skip one each time, so H is followed by J."],
  ["Series", "medium", "What comes next: 1, 1, 2, 3, 5, ?", "", "6", "7", "8", "9", "c", "Each number is the sum of the two before it: 3 + 5 = 8."],
  ["Series", "medium", "What comes next: 2, 6, 12, 20, ?", "", "26", "28", "30", "32", "c", "The gaps grow 4, 6, 8, so the next gap is 10: 20 + 10 = 30."],
  ["Patterns", "medium", "What comes next: 1, 8, 27, 64, ?", "", "100", "121", "125", "144", "c", "These are the cubes 1³, 2³, 3³, 4³, so the next is 5³ = 125."],
  ["Direction", "medium", "Walk 3 km north, then 4 km east. How far are you from the start?", "", "4 km", "5 km", "6 km", "7 km", "b", "The path forms a right triangle, so the distance is √(3² + 4²) = 5 km."],
  ["Counting", "medium", "How many times does the digit 1 appear from 1 to 50?", "", "10", "13", "15", "16", "d", "1, 10-19 (eleven, counting 11 twice), 21, 31, 41 — sixteen in total."],
  ["Patterns", "medium", "What comes next: 3, 7, 15, 31, ?", "", "47", "55", "63", "71", "c", "Each number doubles and adds 1: 31 × 2 + 1 = 63."],
  ["Series", "hard", "What comes next: 2, 3, 5, 7, 11, ?", "", "12", "13", "14", "15", "b", "These are consecutive prime numbers, so 11 is followed by 13."],
  ["Series", "hard", "What comes next: 1, 2, 6, 24, ?", "", "48", "72", "96", "120", "d", "Each number is multiplied by the next integer: 24 × 5 = 120."],
  ["Patterns", "hard", "What comes next: 4, 9, 19, 39, ?", "", "59", "69", "79", "89", "c", "Each number doubles and adds 1: 39 × 2 + 1 = 79."],
  ["Patterns", "hard", "What comes next: 1, 4, 13, 40, ?", "", "80", "94", "108", "121", "d", "Each number triples and adds 1: 40 × 3 + 1 = 121."],
  ["Logic", "hard", "Some cats are black. All black things are visible. Which must be true?", "", "all cats are visible", "some cats are visible", "no cats are visible", "all visible things are cats", "b", "Only the black cats are covered by the rule, so some cats are visible."],
  ["Counting", "hard", "How many 3-digit numbers can be made from 1, 2, 3 with no repeats?", "", "3", "6", "9", "27", "b", "Three choices, then two, then one: 3 × 2 × 1 = 6."],
];

const NUM = [
  ["Arithmetic", "easy", "What is 15 + 27?", "", "40", "41", "42", "43", "c", "15 + 27 = 42."],
  ["Arithmetic", "easy", "What is 8 × 7?", "", "54", "56", "58", "64", "b", "8 × 7 = 56."],
  ["Arithmetic", "easy", "What is 144 ÷ 12?", "", "10", "11", "12", "14", "c", "144 ÷ 12 = 12."],
  ["Arithmetic", "easy", "What is 100 - 37?", "", "62", "63", "64", "73", "b", "100 - 37 = 63."],
  ["Percentages", "easy", "What is 10% of 250?", "", "2.5", "25", "50", "125", "b", "10% is one tenth, so 250 ÷ 10 = 25."],
  ["Percentages", "easy", "What is 50% of 88?", "", "38", "42", "44", "48", "c", "50% is half, so 88 ÷ 2 = 44."],
  ["Percentages", "easy", "What is 25% of 200?", "", "25", "40", "50", "75", "c", "25% is a quarter, so 200 ÷ 4 = 50."],
  ["Fractions", "easy", "What is 1/2 + 1/4?", "", "1/6", "2/6", "3/4", "1/8", "c", "1/2 is 2/4, and 2/4 + 1/4 = 3/4."],
  ["Fractions", "easy", "What is 3/4 of 20?", "", "12", "14", "15", "16", "c", "20 ÷ 4 = 5, and 5 × 3 = 15."],
  ["Averages", "easy", "What is the average of 4, 6 and 8?", "", "5", "6", "7", "8", "b", "The total is 18, and 18 ÷ 3 = 6."],
  ["Averages", "easy", "What is the average of 10 and 20?", "", "10", "12", "15", "20", "c", "The total is 30, and 30 ÷ 2 = 15."],
  ["Ratios", "easy", "Divide 20 sweets between two children in the ratio 1:1. How many each?", "", "5", "10", "15", "20", "b", "An equal split gives 20 ÷ 2 = 10 each."],
  ["Ratios", "easy", "The ratio of boys to girls is 2:3. If there are 10 boys, how many girls?", "", "12", "15", "18", "20", "b", "Each ratio unit is 5 boys, so the girls are 3 × 5 = 15."],
  ["Arithmetic", "easy", "What is 9 × 9?", "", "72", "79", "81", "89", "c", "9 × 9 = 81."],
  ["Arithmetic", "easy", "What is 45 ÷ 9?", "", "4", "5", "6", "9", "b", "45 ÷ 9 = 5."],
  ["Number sense", "easy", "Which is the largest: 0.5, 0.45, 0.55, 0.05?", "", "0.5", "0.45", "0.55", "0.05", "c", "Comparing to two decimal places, 0.55 is the largest."],
  ["Number sense", "easy", "Which of these is a prime number?", "", "9", "15", "17", "21", "c", "17 divides only by 1 and itself; the others have smaller factors."],
  ["Arithmetic", "easy", "What is 12 × 11?", "", "121", "131", "132", "144", "c", "12 × 11 = 132."],
  ["Percentages", "medium", "A shirt costs 800 and is discounted 15%. What is the new price?", "", "640", "680", "700", "720", "b", "15% of 800 is 120, and 800 - 120 = 680."],
  ["Percentages", "medium", "A price rises from 200 to 250. What is the percentage increase?", "", "20%", "25%", "30%", "50%", "b", "The rise is 50, and 50 ÷ 200 = 25%."],
  ["Speed", "medium", "A car travels 180 km in 3 hours. What is its average speed?", "", "50 km/h", "55 km/h", "60 km/h", "65 km/h", "c", "180 ÷ 3 = 60 km/h."],
  ["Averages", "medium", "The average of 5 numbers is 12. What is their total?", "", "50", "55", "60", "65", "c", "The total is 5 × 12 = 60."],
  ["Ratios", "medium", "Divide 60 in the ratio 2:3. What is the larger share?", "", "24", "30", "36", "40", "c", "There are 5 parts of 12, so the larger share is 3 × 12 = 36."],
  ["Work", "medium", "If 4 workers build a wall in 6 days, how long do 8 workers take?", "", "2 days", "3 days", "4 days", "12 days", "b", "Doubling the workers halves the time: 6 ÷ 2 = 3 days."],
  ["Percentages", "hard", "A price rises 20% then falls 20%. What is the net change?", "", "no change", "4% decrease", "4% increase", "2% decrease", "b", "100 becomes 120, then 120 × 0.8 = 96 — a 4% fall."],
  ["Interest", "hard", "What is the simple interest on 5000 at 8% for 2 years?", "", "400", "600", "800", "1000", "c", "5000 × 0.08 × 2 = 800."],
  ["Speed", "hard", "A train covers 120 km at 40 km/h, then 120 km at 60 km/h. What is the average speed?", "", "45 km/h", "48 km/h", "50 km/h", "52 km/h", "b", "The trip takes 3 + 2 = 5 hours for 240 km, so 240 ÷ 5 = 48 km/h."],
  ["Work", "hard", "A fills a tank in 6 hours, B in 12. Working together, how long?", "", "3 hours", "4 hours", "8 hours", "9 hours", "b", "Together they fill 1/6 + 1/12 = 1/4 per hour, so 4 hours."],
  ["Averages", "hard", "The average of 4 numbers is 20. Removing one leaves an average of 22. What was removed?", "", "12", "14", "16", "18", "b", "The total was 80, and the remaining three total 66, so 80 - 66 = 14."],
  ["Ratios", "hard", "Ratio 3:5 becomes 2:3 when 4 is added to both. What is the smaller original number?", "", "12", "16", "20", "24", "a", "3x + 4 over 5x + 4 equals 2/3 gives x = 4, so the smaller number is 12."],
];

const OUT = [
  ["Arrays", "easy", "What does this print?", "console.log([1, 2, 3].length);", "2", "3", "4", "undefined", "b", "The array holds three elements, so length is 3."],
  ["Strings", "easy", "What does this print?", "console.log('abc'.toUpperCase());", "abc", "ABC", "Abc", "undefined", "b", "toUpperCase returns the whole string in capitals."],
  ["Math", "easy", "What does this print?", "console.log(2 + 3 * 4);", "20", "14", "24", "9", "b", "Multiplication binds tighter, so 3 * 4 = 12, then 2 + 12 = 14."],
  ["Strings", "easy", "What does this print?", "console.log('5' + 5);", "10", "55", "25", "NaN", "b", "A string plus a number concatenates, giving '55'."],
  ["Math", "easy", "What does this print?", "console.log(10 % 3);", "0", "1", "3", "10", "b", "The remainder of 10 divided by 3 is 1."],
  ["Arrays", "easy", "What does this print?", "console.log([1, 2, 3].indexOf(2));", "0", "1", "2", "-1", "b", "The value 2 sits at index 1, counting from zero."],
  ["Booleans", "easy", "What does this print?", "console.log(3 > 2);", "true", "false", "1", "undefined", "a", "3 is greater than 2, so the comparison is true."],
  ["Strings", "easy", "What does this print?", "console.log('hello'.length);", "4", "5", "6", "undefined", "b", "The word 'hello' has five characters."],
  ["Math", "easy", "What does this print?", "console.log(Math.max(4, 9, 2));", "4", "2", "9", "15", "c", "Math.max returns the largest argument, which is 9."],
  ["Loops", "easy", "What does this print?", "let n = 0;\nfor (let i = 0; i < 3; i++) n++;\nconsole.log(n);", "0", "2", "3", "4", "c", "The loop runs three times, incrementing n each pass."],
  ["Arrays", "easy", "What does this print?", "console.log([3, 1, 2].sort());", "[3, 1, 2]", "[1, 2, 3]", "[3, 2, 1]", "undefined", "b", "sort orders the elements ascending by default."],
  ["Strings", "easy", "What does this print?", "console.log('a,b,c'.split(',').length);", "1", "2", "3", "4", "c", "Splitting on the comma yields three pieces."],
  ["Math", "easy", "What does this print?", "console.log(Math.floor(4.9));", "4", "5", "4.9", "0", "a", "Math.floor rounds down to the nearest whole number."],
  ["Booleans", "easy", "What does this print?", "console.log(!true);", "true", "false", "0", "undefined", "b", "The ! operator inverts true to false."],
  ["Arrays", "easy", "What does this print?", "console.log([1, 2].concat([3, 4]));", "[1, 2]", "[3, 4]", "[1, 2, 3, 4]", "[[1, 2], [3, 4]]", "c", "concat joins the two arrays into one flat array of four elements."],
  ["Functions", "easy", "What does this print?", "function f(x) { return x * 2; }\nconsole.log(f(5));", "5", "7", "10", "25", "c", "The function doubles its argument: 5 * 2 = 10."],
  ["Math", "easy", "What does this print?", "console.log(7 / 2);", "3", "3.5", "4", "1", "b", "JavaScript division is not integer division, so the result is 3.5."],
  ["Strings", "easy", "What does this print?", "console.log('abc'.charAt(1));", "a", "b", "c", "1", "b", "charAt(1) is the second character, counting from zero."],
  ["Types", "medium", "What does this print?", "console.log(typeof null);", "null", "object", "undefined", "number", "b", "typeof null returns 'object' — a long-standing quirk of the language."],
  ["Coercion", "medium", "What does this print?", "console.log('5' - 2);", "3", "52", "'3'", "NaN", "a", "The minus operator coerces the string to a number, giving 3."],
  ["Scope", "medium", "What does this print?", "let x = 1;\nfunction f() { let x = 2; }\nf();\nconsole.log(x);", "1", "2", "undefined", "error", "a", "The inner x is a separate variable, so the outer one is unchanged."],
  ["Arrays", "medium", "What does this print?", "console.log([1, 2, 3].map(n => n * 2)[1]);", "2", "4", "6", "undefined", "b", "The mapped array is [2, 4, 6], and index 1 holds 4."],
  ["Equality", "medium", "What does this print?", "console.log(1 == '1', 1 === '1');", "true true", "true false", "false true", "false false", "b", "== coerces the types and matches; === compares types too and does not."],
  ["Closures", "medium", "What does this print?", "let c = 0;\nconst inc = () => ++c;\ninc(); inc();\nconsole.log(c);", "0", "1", "2", "undefined", "c", "The arrow function increments the shared c twice."],
  ["Hoisting", "hard", "What does this print?", "console.log(typeof x);\nvar x = 5;", "5", "number", "undefined", "error", "c", "var is hoisted without its value, so x is undefined at that point."],
  ["Async", "hard", "What order does this print?", "console.log(1);\nsetTimeout(() => console.log(2), 0);\nconsole.log(3);", "1 2 3", "1 3 2", "2 1 3", "3 1 2", "b", "The timeout callback runs after the synchronous code, even at 0 ms."],
  ["Coercion", "hard", "What does this print?", "console.log([] + []);", "[]", "0", "'' (empty string)", "undefined", "c", "Both arrays convert to empty strings, so the result is an empty string."],
  ["Closures", "hard", "What does this print?", "for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);", "0 1 2", "3 3 3", "0 0 0", "undefined", "b", "var is function-scoped, so all three callbacks read the final value 3."],
  ["References", "hard", "What does this print?", "const a = [1, 2];\nconst b = a;\nb.push(3);\nconsole.log(a.length);", "1", "2", "3", "error", "c", "Both names point at the same array, so the push is visible through a."],
  ["Precision", "hard", "What does this print?", "console.log(0.1 + 0.2 === 0.3);", "true", "false", "NaN", "error", "b", "Binary floating point makes the sum slightly above 0.3, so they differ."],
];

const STP = [
  ["Ordering", "easy", "To make tea: (1) pour water (2) boil water (3) add tea leaves. Correct order?", "", "1, 2, 3", "2, 1, 3", "2, 3, 1", "3, 2, 1", "b", "The water is boiled first, then poured, then the leaves are added."],
  ["Ordering", "easy", "To send an email: (1) write the message (2) open the client (3) press send. Correct order?", "", "1, 2, 3", "2, 1, 3", "3, 2, 1", "2, 3, 1", "b", "The client is opened, the message written, then it is sent."],
  ["Ordering", "easy", "To save a file: (1) choose a folder (2) click Save (3) name the file. Correct order?", "", "1, 3, 2", "2, 1, 3", "3, 1, 2", "1, 2, 3", "a", "A folder is chosen, the file named, then saved."],
  ["Ordering", "easy", "To run a program: (1) run it (2) write the code (3) save the file. Correct order?", "", "1, 2, 3", "2, 3, 1", "3, 2, 1", "2, 1, 3", "b", "The code is written, saved, then run."],
  ["Ordering", "easy", "To withdraw cash: (1) enter PIN (2) insert card (3) take the money. Correct order?", "", "1, 2, 3", "2, 1, 3", "3, 1, 2", "1, 3, 2", "b", "The card goes in, the PIN is entered, then the cash is taken."],
  ["Ordering", "easy", "To install an app: (1) open it (2) download it (3) tap install. Correct order?", "", "2, 3, 1", "1, 2, 3", "3, 2, 1", "2, 1, 3", "a", "The app is downloaded, installed, then opened."],
  ["Ordering", "easy", "To make a call: (1) speak (2) dial the number (3) press call. Correct order?", "", "1, 2, 3", "2, 3, 1", "3, 2, 1", "2, 1, 3", "b", "The number is dialled, the call placed, then you speak."],
  ["Ordering", "easy", "To print a page: (1) press Print (2) open the file (3) choose a printer. Correct order?", "", "2, 3, 1", "1, 2, 3", "3, 1, 2", "2, 1, 3", "a", "The file is opened, a printer chosen, then printing starts."],
  ["Debug steps", "easy", "First step when a program crashes?", "", "rewrite everything", "read the error message", "restart the computer", "delete the file", "b", "The error message names the problem and is the cheapest place to start."],
  ["Ordering", "easy", "To log in: (1) enter password (2) enter username (3) click submit. Correct order?", "", "1, 2, 3", "2, 1, 3", "3, 2, 1", "1, 3, 2", "b", "The username comes first, then the password, then submit."],
  ["Ordering", "easy", "To bake a cake: (1) mix (2) bake (3) gather ingredients. Correct order?", "", "3, 1, 2", "1, 2, 3", "2, 1, 3", "3, 2, 1", "a", "Ingredients are gathered, mixed, then baked."],
  ["Ordering", "easy", "To back up a file: (1) copy the file (2) choose a destination (3) verify the copy. Correct order?", "", "1, 2, 3", "2, 1, 3", "3, 1, 2", "1, 3, 2", "b", "A destination is chosen, the file copied, then the copy checked."],
  ["Debug steps", "easy", "What should you do before changing code to fix a bug?", "", "reproduce the bug", "deploy to production", "delete the tests", "rename the file", "a", "A bug you cannot reproduce cannot be confirmed fixed."],
  ["Ordering", "easy", "To water a plant: (1) pour water (2) fill the can (3) check the soil. Correct order?", "", "3, 2, 1", "1, 2, 3", "2, 1, 3", "3, 1, 2", "a", "The soil is checked, the can filled, then the water poured."],
  ["Ordering", "easy", "To sort post: (1) read the address (2) open the box (3) place in a pile. Correct order?", "", "2, 1, 3", "1, 2, 3", "3, 2, 1", "2, 3, 1", "a", "The box is opened, the address read, then the item filed."],
  ["Ordering", "easy", "To take a photo: (1) press the shutter (2) open the camera (3) frame the shot. Correct order?", "", "2, 3, 1", "1, 2, 3", "3, 1, 2", "2, 1, 3", "a", "The camera is opened, the shot framed, then the shutter pressed."],
  ["Debug steps", "easy", "Where should you look first for a failed database connection?", "", "the CSS file", "the connection settings", "the image folder", "the font files", "b", "A connection failure points at the connection configuration."],
  ["Ordering", "easy", "To board a train: (1) find the platform (2) buy a ticket (3) board. Correct order?", "", "2, 1, 3", "1, 2, 3", "3, 2, 1", "1, 3, 2", "a", "A ticket is bought, the platform found, then you board."],
  ["Ordering", "medium", "To deploy safely: (1) run tests (2) merge (3) write code (4) deploy. Correct order?", "", "3, 1, 2, 4", "1, 3, 2, 4", "3, 2, 1, 4", "4, 3, 1, 2", "a", "Code is written, tested, merged, then deployed."],
  ["Ordering", "medium", "To fix a bug: (1) reproduce (2) fix (3) find the cause (4) verify. Correct order?", "", "2, 1, 3, 4", "1, 3, 2, 4", "3, 1, 2, 4", "1, 2, 3, 4", "b", "Reproduce it, find the cause, fix it, then verify the fix."],
  ["Ordering", "medium", "To restore a backup: (1) restore (2) verify the backup (3) stop the service (4) restart. Correct order?", "", "1, 2, 3, 4", "2, 3, 1, 4", "3, 1, 2, 4", "2, 1, 3, 4", "b", "Check the backup, stop the service, restore, then restart."],
  ["Ordering", "medium", "To review code: (1) merge (2) read the diff (3) leave comments (4) approve. Correct order?", "", "2, 3, 4, 1", "1, 2, 3, 4", "2, 1, 3, 4", "3, 2, 4, 1", "a", "Read the diff, comment, approve, then merge."],
  ["Debug steps", "medium", "A page loads slowly. Which step comes first?", "", "buy a bigger server", "measure what is slow", "rewrite the frontend", "add more caching", "b", "Measurement identifies the bottleneck before any money or effort is spent."],
  ["Ordering", "medium", "To onboard a user: (1) send a welcome email (2) verify the address (3) create the account. Correct order?", "", "3, 2, 1", "1, 2, 3", "2, 3, 1", "3, 1, 2", "a", "The account is created, the address verified, then the welcome sent."],
  ["Ordering", "hard", "To migrate a database: (1) migrate (2) back up (3) verify (4) test on a copy (5) announce downtime. Correct order?", "", "2, 4, 5, 1, 3", "1, 2, 3, 4, 5", "5, 1, 2, 3, 4", "4, 1, 2, 5, 3", "a", "Back up, rehearse on a copy, announce, migrate, then verify."],
  ["Ordering", "hard", "To handle an outage: (1) find the cause (2) restore service (3) write a postmortem (4) acknowledge. Correct order?", "", "1, 2, 4, 3", "4, 2, 1, 3", "2, 1, 3, 4", "1, 4, 2, 3", "b", "Acknowledge, restore service first, then find the cause and write it up."],
  ["Ordering", "hard", "To release a feature: (1) full rollout (2) canary (3) monitor (4) feature flag off. Correct order?", "", "4, 2, 3, 1", "1, 2, 3, 4", "2, 1, 3, 4", "3, 4, 2, 1", "a", "Ship it disabled, enable for a canary, monitor, then roll out fully."],
  ["Debug steps", "hard", "Tests pass locally but fail in CI. Which step comes first?", "", "disable the CI tests", "compare the environments", "rerun until it passes", "delete the failing test", "b", "A pass/fail split between environments points at an environment difference."],
  ["Ordering", "hard", "To add an index safely: (1) measure the query (2) build the index (3) confirm the gain (4) check the write cost. Correct order?", "", "2, 1, 3, 4", "1, 2, 3, 4", "1, 4, 2, 3", "4, 1, 2, 3", "c", "Measure first, weigh the write cost, build it, then confirm the gain."],
  ["Ordering", "hard", "To roll back a bad deploy: (1) roll back (2) confirm the deploy caused it (3) notify (4) investigate. Correct order?", "", "2, 1, 3, 4", "1, 2, 3, 4", "4, 2, 1, 3", "3, 4, 1, 2", "a", "Confirm the cause, roll back to stop the bleeding, notify, then investigate."],
];

const SECTIONS = [
  { code: "LOG", marks: "1", rows: LOG },
  { code: "NUM", marks: "1", rows: NUM },
  { code: "OUT", marks: "1.5", rows: OUT },
  { code: "STP", marks: "2", rows: STP },
];

const here = dirname(fileURLToPath(import.meta.url));

for (const { code, marks, rows } of SECTIONS) {
  if (rows.length !== 30) {
    throw new Error(`${code} has ${rows.length} rows, expected 30`);
  }

  const grid = [HEADERS];

  rows.forEach((row, index) => {
    const [topic, difficulty, question, codeBlock, a, b, c, d, correct, explanation] = row;
    const number = String(index + 1).padStart(4, "0");

    grid.push([
      `${code}-T${number}`,
      code,
      `[SAMPLE] ${topic}`,
      difficulty,
      question,
      codeBlock,
      "", // verify_code: authored by hand, so there is nothing machine-checked to record.
      a, b, c, d,
      correct,
      explanation,
      "", // lesson_text: LRN only.
      "", // lesson_group: LRN only, and derived on import regardless.
      "yes",
      marks,
      `${code}-SAMPLE`,
      "",
      "",
      "",
      "",
      "",
      "draft",
    ]);
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), code);

  const path = join(here, `${code} - sample.xlsx`);
  writeFileSync(path, XLSX.write(book, { type: "buffer", bookType: "xlsx" }));

  const counts = rows.reduce((tally, row) => {
    tally[row[1]] = (tally[row[1]] ?? 0) + 1;
    return tally;
  }, {});
  console.log(`${code}: ${rows.length} rows @ ${marks} marks — ${JSON.stringify(counts)} -> ${path}`);
}
