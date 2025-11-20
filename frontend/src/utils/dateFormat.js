const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatValue = (value, options, fallback = "—") => {
  const date = safeDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  } catch {
    return fallback;
  }
};

export const formatDate = (value, opts = {}) => {
  const { fallback = "—", ...custom } = opts;
  return formatValue(
    value,
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...custom,
    },
    fallback
  );
};

export const formatDateTime = (value, opts = {}) => {
  const { fallback = "—", includeTimeZone = false, ...custom } = opts;
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...custom,
  };
  if (includeTimeZone) {
    options.timeZoneName = "short";
  }
  return formatValue(value, options, fallback);
};

export const formatTime = (value, opts = {}) => {
  const { fallback = "—", includeSeconds = false, ...custom } = opts;
  return formatValue(
    value,
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(includeSeconds ? { second: "2-digit" } : {}),
      ...custom,
    },
    fallback
  );
};

