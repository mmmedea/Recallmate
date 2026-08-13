const pptxgen = require("pptxgenjs");
const officeParser = require("officeparser");
const fs = require("fs");

async function main() {
    let pptx = new pptxgen();
    let slide = pptx.addSlide();
    slide.addText("Hello World from PPTX Extraction Test", { x: 1, y: 1, fontSize: 24 });
    slide.addText("This is the second line of text.", { x: 1, y: 2, fontSize: 18 });
    
    const fileName = "test-presentation.pptx";
    await pptx.writeFile({ fileName });
    console.log(`Created ${fileName}`);
    
    console.log("Parsing with officeparser...");
    const ast = await officeParser.parseOffice(fileName);
    const textOutput = await ast.to('text');
    const parsedText = textOutput.value || textOutput;
    console.log("Extraction Result:");
    console.log(parsedText);
    
    // Check if expected text is in output
    if (parsedText.includes("Hello World from PPTX") && parsedText.includes("second line")) {
        console.log("✅ SUCCESS: Extraction returned the correct text!");
        process.exit(0);
    } else {
        console.error("❌ ERROR: Missing expected text in extraction output.");
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
