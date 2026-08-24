import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlusWorkspaceSummary,
  WORKSPACE_FILE_STATUSES
} from "../data/plusWorkspaceSummary.js";

const makeFlow = (key, total) => ({
  key,
  data: {
    id: key,
    steps: Array.from({ length: total }, (_, index) => ({ id: `${key}_${index}` }))
  }
});

const makeDone = (key, total) => Object.fromEntries(
  Array.from({ length: total }, (_, index) => [`${key}_${index}`, true])
);

test("builds the saved-file, date, checklist, and file-status workspace summary", () => {
  const flows = [makeFlow("tps", 11), makeFlow("ead", 11), makeFlow("travel", 11)];
  const flowStates = {
    tps: { noticeDate: "2026-01-01", done: makeDone("tps", 9) },
    ead: { dueDate: "2026-02-01", done: makeDone("ead", 7) },
    travel: { noticeDate: "2026-03-01", done: makeDone("travel", 6) }
  };
  const files = [
    ...Array.from({ length: 4 }, () => ({ status: "Ready" })),
    ...Array.from({ length: 2 }, () => ({ status: "Needs review" })),
    { status: "Submitted" },
    ...Array.from({ length: 5 }, () => ({ status: "" }))
  ];

  const result = buildPlusWorkspaceSummary({ flows, flowStates, files });

  assert.equal(result.savedFiles, 12);
  assert.equal(result.savedDates, 3);
  assert.equal(result.averageProgress, 67);
  assert.deepEqual(result.progress.map(({ completed, total, percent }) => ({ completed, total, percent })), [
    { completed: 9, total: 11, percent: 82 },
    { completed: 7, total: 11, percent: 64 },
    { completed: 6, total: 11, percent: 55 }
  ]);
  assert.deepEqual(result.fileStatuses, {
    [WORKSPACE_FILE_STATUSES[0]]: 4,
    [WORKSPACE_FILE_STATUSES[1]]: 2,
    [WORKSPACE_FILE_STATUSES[2]]: 1
  });
});

test("returns stable zero summaries when workspace data is empty", () => {
  assert.deepEqual(buildPlusWorkspaceSummary(), {
    savedFiles: 0,
    savedDates: 0,
    averageProgress: 0,
    progress: [],
    fileStatuses: {
      Ready: 0,
      "Needs review": 0,
      Submitted: 0
    }
  });
});
