//const Terser = require('terser');
const Obfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');



const DESTINATION_PATH = ['elementWithObfuscatorCode', 'actionWithObfuscatorCode'];
const SOURCE_PATH = ['elements', 'actions'];




const FOLDERS_TO_PROCESS = [
	{
		source: 'elements',
		destination: 'elementsObfuscated',
	},
	{
		source: 'actions',
		destination: 'actionsObfuscated',
	}
]

function processDirectory(rootDirectory, destinationDirectory, sourcePath = rootDirectory) {

	const rootDestination = sourcePath.replace(rootDirectory, destinationDirectory);
	const sourceElements = fs.readdirSync(
		path.resolve(sourcePath),
	);



	sourceElements.forEach((elementPath) => {
		const destinationElementPath = path.resolve(rootDestination, elementPath);
		const scripts = fs.readdirSync(
			path.resolve(sourcePath, elementPath),
		);

		if (!fs.existsSync(destinationElementPath)) {
			fs.mkdirSync(destinationElementPath, {recursive: true});
		}

		scripts.map(async (script) => {
			const sourceFilePath = path.resolve(sourcePath, elementPath, script);
			const destinationFilePath = path.resolve(destinationElementPath, script);
			const fileStat = fs.statSync(sourceFilePath);

			if (!fileStat.isFile()) {
				processDirectory(rootDirectory, destinationDirectory, sourceFilePath);
				return;
			}

			const filePath = path.resolve(sourcePath, elementPath, script);
			const fileExtension = path.extname(filePath);

			if (fileExtension !== '.js') {
				fs.copyFileSync(sourceFilePath, destinationFilePath);
				return;
			}

			const scriptNameNoExtension = script.replace('.js', '');

			const scriptContent = fs.readFileSync(filePath).toString().trim();
			const [, asyncModifier, , scriptName, scriptParameters] = scriptContent.match(/^(async)?\s*(function)\s*(.*?)(\(.*?\))/) ?? [];
			const scriptValidName = scriptName || scriptNameNoExtension;
			const scriptContentValidStructure = scriptName
				? scriptContent
				: scriptContent.replace(/^(async)?\s*(function)\s*(.*?)(\(.*?\))/, `$1 $2 ${scriptValidName}$4`);

			if (!scriptParameters) {
				throw new Error(`Invalid script format. Please check the function declaration. Error in: ${sourceFilePath}`);
			}

			try {
				const obfuscatedScriptContent = Obfuscator.obfuscate(scriptContentValidStructure, {
					optionsPreset: 'default',
					compact: false,
					ignoreImports: true,
				});

				const wrapperScriptContent = `${asyncModifier ?? ''} function${scriptParameters}{\n\t${obfuscatedScriptContent.getObfuscatedCode()}\n\t${asyncModifier ? 'await' : ''} ${scriptValidName}${scriptParameters};\n}`.trim();

				fs.writeFileSync(
					destinationFilePath,
					wrapperScriptContent,
				);
			} catch (e) {
				console.error(`Could not process script ${script} for element ${elementPath}`);
				throw e;
			}
		});
	});
}


FOLDERS_TO_PROCESS.forEach(({source, destination}) => {
	const sourcePathExist = fs.existsSync(
		path.resolve(source)
	)
	const buildPathExists = fs.existsSync(
		path.resolve(destination)
	);

	if (!buildPathExists && sourcePathExist) {
		fs.mkdirSync(destination);
	}

	if (sourcePathExist) {
		processDirectory(source, destination);
	}
});
