import {
	IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';
import { promises as fsPromise } from 'fs-extra';
import { file as tmpFile } from 'tmp-promise';
import { exec } from 'child_process';

export class Markitdown implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Markitdown',
		name: 'markitdownNode',
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

        // Check if the input item has the specified binary property
        if (!items[i].binary?.[filePathName]) {
          throw new NodeOperationError(
            this.getNode(),
            `No binary data property "${filePathName}" exists on item!`,
            { itemIndex: i },
          );
        }

        // Get the binary data
        const binaryData = Buffer.from(items[i].binary![filePathName].data, 'base64');

        // Create temporary input file
        const inputTmpFile = await tmpFile();
        await fsPromise.writeFile(inputTmpFile.path, binaryData);

        // Create temporary output file path
        const outputTmpFile = await tmpFile();
        await fsPromise.unlink(outputTmpFile.path); // We just need the path, not the file
        const outputPath = `${outputTmpFile.path}.md`;

        // Build the markitdown command
        const command = `markitdown convert "${inputTmpFile.path}" -o "${outputPath}"`.trim();

        // Execute markitdown
        await exec.__promisify__(command);

        // Read the output file
        const outputContent = await fsPromise.readFile(outputPath);

        // Prepare the output item
        const newItem: INodeExecutionData = {
          json: { ...items[i].json },
          binary: { ...items[i].binary },
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
          fsPromise.unlink(outputPath).catch(() => {}),
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

