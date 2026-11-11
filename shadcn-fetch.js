const fs = require('fs');
const path = require('path');
const https = require('https');

const components = [
  'button', 'input', 'badge', 'skeleton', 'progress', 
  'dialog', 'toast', 'toaster', 'use-toast', 'label', 
  'textarea', 'checkbox', 'dropdown-menu', 'tooltip'
];

const uiDir = path.join(__dirname, 'components', 'ui');
const hooksDir = path.join(__dirname, 'hooks');
if (!fs.existsSync(uiDir)) fs.mkdirSync(uiDir, { recursive: true });
if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

async function fetchComponent(name) {
  return new Promise((resolve, reject) => {
    https.get(`https://ui.shadcn.com/r/styles/default/${name}.json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse ${name}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const deps = new Set();
  for (const name of components) {
    try {
      const data = await fetchComponent(name);
      
      // Install dependencies
      if (data.dependencies) data.dependencies.forEach(d => deps.add(d));
      if (data.registryDependencies) {
         // handle internal dependencies if needed, usually we requested all
      }
      
      // Write files
      if (data.files) {
        for (const file of data.files) {
          const targetDir = file.path.includes('use-toast') ? hooksDir : uiDir;
          const fileName = file.path.split('/').pop(); // usually the name
          fs.writeFileSync(path.join(targetDir, fileName), file.content);
          console.log(`Created ${path.join(targetDir, fileName)}`);
        }
      }
    } catch (e) {
      console.error(`Error with ${name}: ${e.message}`);
    }
  }
  
  if (deps.size > 0) {
    console.log('\nPlease run:');
    console.log(`npm install ${Array.from(deps).join(' ')}`);
  }
}

run();
