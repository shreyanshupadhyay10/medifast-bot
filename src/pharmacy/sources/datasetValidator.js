const validatePharmacyRecord = (record = {}) => {
  const errors = [];
  const coordinates = record.location?.coordinates || record.geoLocation?.coordinates;

  if (!record.name) errors.push("Missing pharmacy name.");
  if (!record.area) errors.push("Missing area/locality.");
  if (!record.address) errors.push("Missing address.");
  if (!coordinates || coordinates.length !== 2) {
    errors.push("Missing coordinates.");
  } else {
    const [longitude, latitude] = coordinates.map(Number);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push("Invalid latitude.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push("Invalid longitude.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateDataset = (records = []) => {
  const valid = [];
  const failed = [];
  const coordinateIssues = [];

  records.forEach((record, index) => {
    const result = validatePharmacyRecord(record);
    if (result.valid) {
      valid.push(record);
      return;
    }

    const failedRecord = { index, record, errors: result.errors };
    failed.push(failedRecord);
    if (result.errors.some((error) => /coordinate|latitude|longitude/i.test(error))) {
      coordinateIssues.push(failedRecord);
    }
  });

  return { valid, failed, coordinateIssues };
};

module.exports = {
  validateDataset,
  validatePharmacyRecord,
};
