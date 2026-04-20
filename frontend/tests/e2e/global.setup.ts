import { execSync } from 'child_process';
import path from 'path';

function run(command: string) {
  execSync(command, {
    cwd: path.resolve(__dirname, '../../..'),
    stdio: 'inherit',
  });
}

export default async function globalSetup() {
  run('cmd /c start_local_postgres.bat');
  run('.\\venv\\Scripts\\python.exe backend\\manage.py seed_e2e_data');
}
