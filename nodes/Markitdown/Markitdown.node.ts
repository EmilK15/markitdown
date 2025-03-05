import {
	IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription
} from 'n8n-workflow';
import { promises as fsPromise } from 'fs-extra';
import { file as tmpFile } from 'tmp-promise';
import { exec } from 'child_process';
import { promisify } from 'util'

const execPromise = promisify(exec);

export class Markitdown implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Markitdown',
		name: 'markitdown',
		icon: 'file:microsoft.svg',
		group: ['transform'],
		version: 1,
		description: 'Convert any file into markdown',
		defaults: {
			name: 'Markitdown',
		},
		// @ts-ignore
		inputs: ['main'],
		// @ts-ignore
		outputs: ['main'],
		properties: [
      {
        displayName: 'File Path',
        name: 'filePathName',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the binary property containing the file to process',
      },
      {
        displayName: 'Output Property Name',
        name: 'outputPropertyName',
        type: 'string',
        default: 'data',
        description: 'Name of output',
      },
    ],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const filePathName = this.getNodeParameter('filePathName', i) as string;
        const outputPropertyName = this.getNodeParameter('outputPropertyName', i) as string;

				const binaryData = this.helpers.assertBinaryData(i, filePathName);

				// Step 2: Write the file to a tmp directory
				const inputTmpFile = await tmpFile({
					prefix: 'n8n-markitdown-input-',
					postfix: binaryData.fileName
				});
				await fsPromise.writeFile(inputTmpFile.path, Buffer.from(binaryData.data, 'base64'));

				// Step 3: Run markitdown command on the tmp file
				const outputTmpFile = await tmpFile({
					prefix: 'n8n-markitdown-output-',
					postfix: '.md'
				});

        // Build the markitdown command
        const command = `markitdown "${inputTmpFile.path}" -o "${outputTmpFile.path}"`.trim();

        // Execute markitdown
        await execPromise(command);

        // Read the output file
        const outputContent = await fsPromise.readFile(outputTmpFile.path);

        // Prepare the output item
        const newItem: INodeExecutionData = {
          json: { },
          binary: { },
        };

        // Add output to binary property
        newItem.binary![outputPropertyName] = await this.helpers.prepareBinaryData(
          outputContent,
          `${outputPropertyName}.md`,
          'text/markdown',
        );

        returnData.push(newItem);

        // Clean up temporary files
        await Promise.all([
          inputTmpFile.cleanup(),
          outputTmpFile.cleanup()
        ]);

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

