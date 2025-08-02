export const validateFileExtension = (_filename: string): boolean => {
  const allowedExtensions = ['.csv', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xlsx', '.json'];
  return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

export const validateFilename = (_filename: string): boolean => {
  return /^[a-zA-Z0-9_\-\.]+$/.test(filename); // allows alphanumeric, -, _, .
};
