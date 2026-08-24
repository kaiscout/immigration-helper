export function shouldCountCasePilotQuestion(data) {
  return Boolean(data && data.degraded !== true && data?.answer_profile?.degraded !== true);
}
