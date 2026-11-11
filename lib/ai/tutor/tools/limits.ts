export const ToolLimits = {
  // Max number of tool calls permitted in a single interaction to prevent infinite loops
  MAX_TOOL_CALLS_PER_INTERACTION: 3,
  
  // Execution time limit for native code execution in ms (Note: Gemini API also has its own limits)
  MAX_EXECUTION_TIMEOUT_MS: 30000, 
  
  // Max size of the code payload (preventing massive script dumps)
  MAX_CODE_PAYLOAD_LENGTH: 5000,
  
  // We explicitly deny these string patterns in generated code as an extra safety boundary,
  // although Gemini's sandbox already isolates network/fs/db.
  RESTRICTED_CODE_PATTERNS: [
    "import os",
    "import sys",
    "import subprocess",
    "import socket",
    "import urllib",
    "import requests",
    "open(",
    "__import__",
    "eval(",
    "exec("
  ]
};
