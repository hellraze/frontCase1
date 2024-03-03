require('dotenv').config();
const superagent = require('superagent');
const path = require('path');
const fs = require('fs/promises');
const { SingleBar } = require('cli-progress');
const chalk = require('chalk');

const { FIGMA_TOKEN } = process.env;

const FIGMA_API_HOST = 'https://api.figma.com/v1';
const FIGMA_KEY = '1TDMKALpzX0ByUE7Jo2Fw8';
const PAGE_NAME = 'Icons';
const BASE_DIR = '/public';

const agent = superagent.agent();

var argv = require('minimist')(process.argv.slice(2));

async function fetchData() {
    let figmaDocument;

    try {
        figmaDocument = (
            await agent
                .get(`${FIGMA_API_HOST}/files/${FIGMA_KEY}`)
                .set('X-FIGMA-TOKEN', FIGMA_TOKEN)
        ).body.document.children;
    } catch (error) {
        console.error(error);
        process.exit(1);
    }

    const folderNames = [];
    const icons = figmaDocument
        .find(({ name }) => name === PAGE_NAME)
        .children
        .reduce((acc, item) => {
            const { name: folderName, children } = item;
            folderNames.push(folderName);

            return [...acc, ...children];
        }, []);
    let iconsData;
    try {
        const iconUrls = (
            await agent
                .get(`${FIGMA_API_HOST}/images/${FIGMA_KEY}`)
                .query({
                    ids: icons.map(({ id }) => id).join(','),
                    format: 'svg',
                })
                .set('X-FIGMA-TOKEN', FIGMA_TOKEN)
        ).body.images;

        iconsData = icons.map(icon => ({
            ...icon,
            url: iconUrls[icon.id],
        }));
    } catch (error) {
        console.error(error);
        process.exit(1);
    }

    const extension = '.svg';
    let folderPath = argv['dirname'] ? path.join(process.cwd(), BASE_DIR, argv['dirname']) : undefined;

    if (!folderPath) {
        folderPath = path.join(process.cwd(), BASE_DIR)
    }

    try {
        await fs.mkdir(folderPath);
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(error);
            process.exit(1);
        }
    }

    const progressBar = new SingleBar({
        format: `${chalk.green('Progress')} |${chalk.green('{bar}')}| {percentage}% || {value}/{total} Icons`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });

    progressBar.start(iconsData.length, 0);

    for (const [index, icon] of iconsData.entries()) {
        const iconSvg = (await agent.get(icon.url)).body;
        const iconName = `${icon.name.replaceAll(/ |\//g, '')}${extension}`;

        try {
            await fs.writeFile(
                path.join(folderPath, iconName),
                iconSvg,
            );
        } catch (error) {
            console.error(error);
        }

        progressBar.update(index + 1);
    }

    progressBar.stop();
}

fetchData();
