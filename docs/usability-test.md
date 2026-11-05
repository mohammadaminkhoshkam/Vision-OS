# Usability test protocol

A small, repeatable test to check whether the redesign is actually easier to use than the 0.4 baseline, not just prettier. It follows the plan from the design review: 5–8 target users, four unguided tasks, measured with the built-in study recorder.

## Participants

- 5–8 people who read research papers regularly (students, researchers, engineers).
- Half start with the baseline build, half with the redesign, to balance learning effects.
- Each person tests one build only, or both builds a week apart with a different paper.

## Builds

| Build | How to get it |
|---|---|
| Baseline | `git checkout 155cd41` (Vision OS 0.4) |
| Redesign | this branch |

The study recorder only exists in the redesign. For the baseline, time the tasks with a stopwatch and count errors and navigation by observation, using the same definitions as below.

## Before each session

1. Use a fresh profile: clear the app data or start with an empty `localStorage`.
2. Load the same Marginal library and the same paper for everyone.
3. In **Settings → Usability study**, enter the participant code, choose the build and press **Start**.
4. Read the consent note aloud: only screen names, page numbers, counts and warnings are recorded, on this computer. No text, no camera images.

## Tasks (read aloud, one at a time, no hints)

1. **Open a PDF.** “Open the paper *…* and go to its introduction.”
2. **Move a note to the board.** “Put one sentence from the paper on the knowledge board.”
3. **Start the study timer.** “Start a focus session for this reading.”
4. **Leave and come back.** “Go somewhere else in the app (or close it), then return to the same place in the paper.”

Allow up to 5 minutes per task. If someone is stuck, note it as *not completed* and move on.

## What is measured

| Measure | Definition |
|---|---|
| Time | Seconds from the end of the previous task (or the start) until the task is done |
| Completion | Whether the task was done within the time limit |
| Errors | Warnings the app showed during the task (for example “Select some text first”) |
| Navigation | Screens visited during the task |
| Confusion | Back-and-forth between the same two screens within 10 seconds |
| Resume | Task 4 counts only if the same paper reopens within one page of where it was left |

Also note what the observer sees: hesitation, wrong guesses, comments. After the session, ask:

- “What were you working on, and where would you continue tomorrow?”
- “What, if anything, felt alive or distracting?”

## After each session

Press **Stop**, then **Export CSV** (and **Raw log** if you want to re-analyse). Collect the CSV files in one folder; they share a header, so they can be concatenated and compared per build and per task (median time, completion rate, total errors).

## Reading the results

- The redesign is better only if tasks are completed more often or faster *and* errors and confusion do not rise.
- Look at task 4 separately: it tests the main promise of the redesign (the workspace remembers where you were).
- Asking “which one is more beautiful?” is not a result.
