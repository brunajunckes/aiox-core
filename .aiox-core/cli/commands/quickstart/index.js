#!/usr/bin/env node
// AIOX Quickstart - Story 2.1
// Zero external deps - Node.js stdlib only

function runQuickstart() {
  const sep = "=".repeat(50);
  const dash = "-".repeat(40);
  console.log(sep);
  console.log(" AIOX Quickstart Guide");
  console.log(sep);
  console.log("");
  console.log("Step 1: Your Agent Team");
  console.log(dash);
  const a = [["@dev","Code"],["@qa","Test"],["@architect","Design"],["@pm","Management"],["@sm","Stories"],["@devops","Deploy"]];
  a.forEach(x => console.log("  " + x[0] + " - " + x[1]));
  console.log("");
  console.log("Step 2: Story-Driven Development");
  console.log(dash);
  console.log("  Stories in docs/stories/");
  console.log("  @sm creates > @dev implements > @qa validates > @devops ships");
  console.log("");
  console.log("Step 3: Quality Gates");
  console.log(dash);
  console.log("  npm run lint | npm run typecheck | npm test");
  console.log("");
  console.log("Step 4: Commands");
  console.log(dash);
  console.log("  aiox doctor | aiox info | aiox validate");
  console.log("");
  console.log("Step 5: Get Started");
  console.log(dash);
  console.log("  1. @sm then *create-story");
  console.log("  2. @dev to implement");
  console.log("  3. @qa to validate");
  console.log("  4. @devops to ship");
  console.log("");
  console.log(sep);
  console.log(" Ready! Happy coding with AIOX!");
  console.log(sep);
}

module.exports = { runQuickstart };
if (require.main === module) runQuickstart();