const REQUIRED_FIELDS = ["medicineName"];

const validateRecord = (record = {}) => {
  const errors = [];
  REQUIRED_FIELDS.forEach((field) => {
    if (!record[field] && !record.name && !record.brand && !record.genericName) {
      errors.push(`Missing required medicine identity (${field}, name, brand, or genericName).`);
    }
  });

  if (record.confidence !== undefined) {
    const confidence = Number(record.confidence);
    if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      errors.push("confidence must be a number between 0 and 1.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateDataset = (records = []) => {
  const failed = [];
  const valid = [];

  records.forEach((record, index) => {
    const result = validateRecord(record);
    if (result.valid) valid.push(record);
    else failed.push({ index, record, errors: result.errors });
  });

  return { valid, failed };
};

module.exports = {
  validateDataset,
  validateRecord,
};
