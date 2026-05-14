const fs = require('fs');

const files = [
  'tests/integration/aiFailureHandling.test.ts',
  'tests/integration/fullOrderFlow.test.ts'
];

function injectStore(content) {
  let newContent = content;

  function processFunction(funcName) {
    let index = 0;
    while (true) {
      index = newContent.indexOf(funcName + '(', index);
      if (index === -1) break;
      
      let openParenIndex = index + funcName.length;
      let parenCount = 1;
      let i = openParenIndex + 1;
      
      while (i < newContent.length && parenCount > 0) {
        if (newContent[i] === '(') parenCount++;
        else if (newContent[i] === ')') parenCount--;
        i++;
      }
      
      if (parenCount === 0) {
        let closeParenIndex = i - 1;
        let hasComma = false;
        let pCount = 0;
        for (let j = openParenIndex + 1; j < closeParenIndex; j++) {
            if (newContent[j] === '(' || newContent[j] === '[' || newContent[j] === '{') pCount++;
            else if (newContent[j] === ')' || newContent[j] === ']' || newContent[j] === '}') pCount--;
            else if (newContent[j] === ',' && pCount === 0) hasComma = true;
        }

        if (!hasComma) {
           newContent = newContent.slice(0, closeParenIndex) + ', useCartStore.getState()' + newContent.slice(closeParenIndex);
        }
      }
      index += funcName.length;
    }
  }

  processFunction('applyCartDelta');
  processFunction('applyCartDeltaSafe');

  return newContent;
}

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const updated = injectStore(content);
  fs.writeFileSync(file, updated);
  console.log(`Updated ${file}`);
});
