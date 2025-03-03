"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Markitdown = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const fs_extra_1 = require("fs-extra");
const tmp_promise_1 = require("tmp-promise");
const child_process_1 = require("child_process");
class Markitdown {
    constructor() {
        this.description = {
            displayName: 'Markitdown',
            name: 'markitdownNode',
            icon: 'file:microsoft.svg',
            group: ['transform'],
            version: 1,
            description: 'Convert any file into markdown',
            defaults: {
                name: 'Markitdown',
            },
            inputs: ['main'],
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
    }
    async execute() {
        var _a;
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            try {
                const filePathName = this.getNodeParameter('filePathName', i);
                const outputPropertyName = this.getNodeParameter('outputPropertyName', i);
                if (!((_a = items[i].binary) === null || _a === void 0 ? void 0 : _a[filePathName])) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `No binary data property "${filePathName}" exists on item!`, { itemIndex: i });
                }
                const binaryData = Buffer.from(items[i].binary[filePathName].data, 'base64');
                const inputTmpFile = await (0, tmp_promise_1.file)();
                await fs_extra_1.promises.writeFile(inputTmpFile.path, binaryData);
                const outputTmpFile = await (0, tmp_promise_1.file)();
                await fs_extra_1.promises.unlink(outputTmpFile.path);
                const outputPath = `${outputTmpFile.path}.md`;
                const command = `markitdown convert "${inputTmpFile.path}" -o "${outputPath}"`.trim();
                await child_process_1.exec.__promisify__(command);
                const outputContent = await fs_extra_1.promises.readFile(outputPath);
                const newItem = {
                    json: { ...items[i].json },
                    binary: { ...items[i].binary },
                };
                newItem.binary[outputPropertyName] = await this.helpers.prepareBinaryData(outputContent, `${outputPropertyName}.md`, 'text/markdown');
                returnData.push(newItem);
                await Promise.all([
                    inputTmpFile.cleanup(),
                    fs_extra_1.promises.unlink(outputPath).catch(() => { }),
                ]);
            }
            catch (error) {
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
exports.Markitdown = Markitdown;
//# sourceMappingURL=MarkitdownNode.node.js.map