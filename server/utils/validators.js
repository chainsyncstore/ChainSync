'use strict';

const validateFileExtension = (filename) => {
  const allowedExtensions = [
    '.csv', '.txt', '.jpg', '.jpeg', '.png', '.gif',
    '.pdf', '.doc', '.docx', '.xlsx', '.json'
  ];
  return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

const validateFilename = (filename) => {
  // allows alphanumeric, -, _, .
  return /^[a-zA-Z0-9_\-\.]+$/.test(filename);
};

export { validateFileExtension, validateFilename };
