const { extractEntities } = require("../ai/entityExtractor");
const { routeMessage, shouldExecute } = require("../ai/router");

const planWorkflow = ({ query, profile, location = null } = {}) => {
  const entities = extractEntities(query, profile);
  const routes = routeMessage({ entities, profile });
  const executableRoutes = routes.filter((route) => shouldExecute(route));
  const tools = executableRoutes.map((route) => route.tool);

  return {
    query,
    entities,
    routes,
    location,
    execute: {
      family: tools.includes("family"),
      medicine: tools.includes("medicine"),
      memory: tools.includes("memory") || tools.includes("family"),
      nearby: tools.includes("nearby") && Boolean(location),
      rag: tools.includes("rag") || Boolean(entities.symptom),
    },
  };
};

module.exports = {
  planWorkflow,
};
