const routeMessage = ({ entities }) => {
  const routes = [];
  const add = (tool, confidence, reason) => {
    if (!routes.some((route) => route.tool === tool)) {
      routes.push({ tool, confidence, reason });
    }
  };

  if (entities.person || entities.familyMemberName) add("family", 0.91, "family entity detected");
  if (entities.reorderIntent) add("memory", 0.9, "reorder/refill intent detected");
  if (entities.condition && (entities.person || entities.familyMemberName)) {
    add("memory", 0.86, "family condition context detected");
  }
  if (entities.medicine || entities.symptom || entities.normalizedMedicineQuery) {
    add("medicine", entities.symptom ? 0.88 : 0.82, "medicine or symptom detected");
  }
  if (entities.nearbyIntent) add("nearby", 0.8, "nearby/location intent detected");
  if (entities.intentType === "side_effects") add("rag", 0.92, "side effect knowledge requested");
  if (entities.intentType === "precautions") add("rag", 0.9, "precaution knowledge requested");
  if (entities.symptom) add("rag", 0.64, "symptom education context");
  add("safety", 0.7, "medical safety pass");

  return routes.sort((a, b) => b.confidence - a.confidence);
};

const shouldExecute = (route, threshold = 0.5) => route.confidence >= threshold;

module.exports = {
  routeMessage,
  shouldExecute,
};
