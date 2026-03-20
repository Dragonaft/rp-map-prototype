// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

export const logger = {
  log: (message: string, context = 'ImportProvinces') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.green}[Logger]${colors.reset} ${colors.dim}${process.pid}  - ${colors.reset}${timestamp}     ${colors.green}LOG${colors.reset} ${colors.yellow}[${context}]${colors.reset} ${colors.green}${message}${colors.reset}`,
    );
  },
  error: (message: string, context = 'ImportProvinces') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.green}[Logger]${colors.reset} ${colors.dim}${process.pid}  - ${colors.reset}${timestamp}     ${colors.red}ERROR${colors.reset} ${colors.yellow}[${context}]${colors.reset} ${colors.red}${message}${colors.reset}`,
    );
  },
  warn: (message: string, context = 'ImportProvinces') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.green}[Logger]${colors.reset} ${colors.dim}${process.pid}  - ${colors.reset}${timestamp}     ${colors.yellow}WARN${colors.reset} ${colors.yellow}[${context}]${colors.reset} ${colors.yellow}${message}${colors.reset}`,
    );
  },
  verbose: (message: string, context = 'ImportProvinces') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.green}[Logger]${colors.reset} ${colors.dim}${process.pid}  - ${colors.reset}${timestamp}     ${colors.blue}VERBOSE${colors.reset} ${colors.yellow}[${context}]${colors.reset} ${colors.blue}${message}${colors.reset}`,
    );
  },
};
