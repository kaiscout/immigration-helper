export const WORKSPACE_FILE_STATUSES = ["Ready", "Needs review", "Submitted"];

const normalizeStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return WORKSPACE_FILE_STATUSES.find((status) => status.toLowerCase() === normalized) || null;
};

const progressForFlow = (item, state) => {
  const steps = Array.isArray(item?.data?.steps) ? item.data.steps : [];
  const completed = steps.filter((step) => Boolean(state?.done?.[step.id])).length;

  return {
    key: item?.key || item?.data?.id || "flow",
    flow: item?.data,
    completed,
    total: steps.length,
    percent: steps.length ? Math.round((completed / steps.length) * 100) : 0
  };
};

export function buildPlusWorkspaceSummary({ flows = [], flowStates = {}, files = [] } = {}) {
  const progress = flows.map((item) => progressForFlow(item, flowStates[item.key] || {}));
  const savedDates = flows.reduce((count, item) => {
    const state = flowStates[item.key] || {};
    return count + (state.noticeDate || state.dueDate ? 1 : 0);
  }, 0);
  const averageProgress = progress.length
    ? Math.round(progress.reduce((sum, item) => sum + item.percent, 0) / progress.length)
    : 0;
  const fileStatuses = Object.fromEntries(
    WORKSPACE_FILE_STATUSES.map((status) => [status, 0])
  );

  files.forEach((file) => {
    const status = normalizeStatus(file?.status);
    if (status) fileStatuses[status] += 1;
  });

  return {
    savedFiles: files.length,
    savedDates,
    averageProgress,
    progress,
    fileStatuses
  };
}
