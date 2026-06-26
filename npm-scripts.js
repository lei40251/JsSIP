const process = require('process');
const { execSync } = require('child_process');
const { version } = require('./package.json');

const task = process.argv.slice(2).join(' ');

// eslint-disable-next-line no-console
console.log(`npm-scripts.js [INFO] running task "${task}"`);

switch (task)
{
  case 'lint':
  {
    execute('gulp lint');

    break;
  }

  case 'test':
  {
    execute('gulp test');

    break;
  }

  case 'build':
  {
    execute('gulp dist');

    break;
  }

  case 'build:min':
  {
    execute('gulp dist-min-only');

    break;
  }

  case 'build:standard':
  {
    execute('gulp dist-standard');

    break;
  }

  case 'prepublish':
  {
    // 兼容旧入口：历史上这里只做 babel 预处理。
    execute('gulp babel');

    break;
  }

  case 'release':
  {
    // eslint-disable-next-line no-console
    console.log(
      `npm-scripts.js [INFO] release will build distribution artifacts and create the local SDK zip for ${version}.`
    );
    execute('gulp dist');
    execute('gulp zip');

    break;
  }

  default:
  {
    throw new TypeError(`unknown task "${task}"`);
  }
}

function execute(command)
{
  // eslint-disable-next-line no-console
  console.log(`npm-scripts.js [INFO] executing command: ${command}`);

  try
  {
    execSync(command, { stdio: [ 'ignore', process.stdout, process.stderr ] });
  }
  catch (error)
  {
    process.exit(1);
  }
}
