const { spawn, spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appPath = path.join(root, 'backend', 'app.py');

const candidates = [
  process.env.PYTHON ? { command: process.env.PYTHON, args: [] } : null,
  { command: path.join(root, 'backend', '.venv312', 'Scripts', 'python.exe'), args: [] },
  { command: path.join(root, 'backend', '.venv', 'Scripts', 'python.exe'), args: [] },
  { command: 'py', args: ['-3'] },
  { command: 'python', args: [] },
  { command: 'python3', args: [] }
].filter(Boolean);

function works(candidate) {
  const result = spawnSync(candidate.command, [...candidate.args, '-c', 'import flask, flask_cors, flask_jwt_extended, flask_sqlalchemy, pymysql'], {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });
  return result.status === 0;
}

const python = candidates.find(works);

if (!python) {
  console.error('Could not find a Python environment with the Flask backend dependencies installed.');
  console.error('Run: python -m venv backend/.venv312');
  console.error('Then: backend/.venv312/Scripts/python.exe -m pip install -r backend/requirements.txt');
  console.error('Or set PYTHON to a Python executable that already has the backend requirements installed.');
  process.exit(1);
}

const child = spawn(python.command, [...python.args, appPath], {
  cwd: root,
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
