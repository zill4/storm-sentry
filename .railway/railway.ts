import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "storm-sentry";
export default defineRailway(() => {
  const stormSentry = service("storm-sentry", {
    source: github("zill4/storm-sentry", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "NIXPACKS" },
    start: "next start -p $PORT -H 0.0.0.0",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { "us-west2": 1 },
    domains: ["stormsentryai.com", "www.stormsentryai.com"],
  });

  return project("storm-sentry", {
    variables: { managed: false },
    resources: [stormSentry],
  });
});
