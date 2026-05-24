const routeMessage = ({ entities }) => {
  const routes = [];
  const add = (tool, confidence, reason) => {
    if (!routes.some((route) => route.tool === tool)) {
      routes.push({ tool, confidence, reason });
    }
  };

  if (entities.person || entities.familyMemberName) add("family", 0.91, "family entity detected");
  if (entities.reorderIntent) add("memory", 0.9, "reorder/refill intent detected");
  if (entities.medicine || entities.symptom || entities.normalizedMedicineQuery) {
    add("medicine", entities.symptom ? 0.88 : 0.82, "medicine or symptom detected");
  }
  if (entities.nearbyIntent) add("nearby", 0.8, "nearby/location intent detected");
  if (entities.symptom) add("rag", 0.54, "future symptom education context");
  add("safety", 0.7, "medical safety pass");

  return routes.sort((a, b) => b.confidence - a.confidence);
};

const shouldExecute = (route, threshold = 0.5) => route.confidence >= threshold;

module.exports = {
  routeMessage,
  shouldExecute,
};
