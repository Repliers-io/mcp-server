// A tool shaped like discoverTools() entries, and a reporter that records instead of posting.
export const fakeTool = (name, fn, required = []) => ({
  definition: { function: { name, parameters: { type: "object", properties: {}, required } } },
  function: fn,
});

export const fakeReporter = () => {
  const reports = [];
  return { reports, report: (signal) => { reports.push(signal); return { accepted: true, done: Promise.resolve("card") }; } };
};
