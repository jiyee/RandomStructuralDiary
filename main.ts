import {App, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, Editor, MarkdownView} from 'obsidian';
import {FileSuggest} from "./file-suggest";

interface PluginSettings {
    fileWithQuestions: string;
    questionsTemplate: string;
    showHeaders: boolean;
    useAdvancedTemplate: boolean;
    globalNumberOfQuestions: number;
}

const MARKDOWN_EXTENSION = "md";

const DEFAULT_SETTINGS: PluginSettings = {
    fileWithQuestions: null,
    questionsTemplate: '',
    showHeaders: false,
    useAdvancedTemplate: false,
    globalNumberOfQuestions: 5
}


export default class RandomStructuralDiaryPlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'insert-random-questions',
            name: 'Insert random questions',

            callback: async () => {
                let file = this.app.vault.getAbstractFileByPath(`${this.settings.fileWithQuestions}`);
                if (file instanceof TFile) {
                    let fileContent = await this.app.vault.cachedRead(file);
                    await this.fillFileWithQuestions(fileContent);
                } else {
                    await this.fillFileWithQuestions(DEFAULT_QUESTIONS);
                }
            }
        });

        this.addSettingTab(new SettingTab(this.app, this));
    }

    onunload() {
    }

    async loadSettings() {
        let oldSettings = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, oldSettings);

        if(oldSettings && !oldSettings.hasOwnProperty("useAdvancedTemplate")){
            this.settings.useAdvancedTemplate = true;
        }

    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async randomQuestions(): string {
        let file = this.app.vault.getAbstractFileByPath(`${this.settings.fileWithQuestions}`);
        if (file instanceof TFile) {
            let fileContent = await this.app.vault.cachedRead(file);
            return this.generateRandomQuestions(fileContent);
        }

        return "";
    }

    generateRandomQuestions(fileContent: string): string {
        let outputString = '';

        if (this.settings.useAdvancedTemplate) {
            let sections = this.getSections(fileContent);
            let headers = sections.map(x => x[0]);
            let questionsSettings = this.parseQuestionsTemplate();
            let questions = sections.map(x => {
                let numOfQuestions = questionsSettings.get(sections.indexOf(x) + 1);
                if (!numOfQuestions)
                    numOfQuestions = this.getRandomInt(x.length);

                return this.generateRandomQuestionsFromSection(x, numOfQuestions);
            }, this);

            let flattenQuestions = questions.reduce((acc, val, index) => {
                if (this.settings.showHeaders)
                    return acc.concat(headers[index], val);
                else
                    return acc.concat(val);
            }, []);

            outputString = flattenQuestions.join("\n\n\n");
        } else {
            let sections = this.getSections(fileContent);
            let allQuestions = sections.reduce((acc, rec) => {
                rec.shift();
                return acc.concat(rec);
            }, [])
            let numOfQuestions = this.settings.globalNumberOfQuestions;

            let pickedQuestions = [];

            for(let i = 0; i < numOfQuestions; i++){
                let currentRandomNumber = this.getRandomInt(allQuestions.length)
                let pickedQuestion = allQuestions[currentRandomNumber];
                pickedQuestions.push(pickedQuestion);
                allQuestions = allQuestions.filter(x => x !== pickedQuestion);
            }

            outputString = pickedQuestions.join("\n\n\n");
        }

        return outputString;
    }

    private async fillFileWithQuestions(fileContent: string) {
        const outputString = this.generateRandomQuestions(fileContent);

        let activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== MARKDOWN_EXTENSION) {
          let fileName = `RandomDiaryQuestions by ${this.getFancyDate()}.${MARKDOWN_EXTENSION}`;
          activeFile = await this.app.vault.create(fileName, outputString);
        } else {
          let view = this.app.workspace.getActiveViewOfType(MarkdownView);
          view.editor.replaceRange(outputString, view.editor.getCursor())
        }

        let leaf = this.app.workspace.getMostRecentLeaf();
        if (!leaf) {
          let leaf = new WorkspaceLeaf();
          this.app.workspace.createLeafBySplit(leaf);
        }

        await leaf.openFile(activeFile);
    }

    /**
     * Creates array of sections with questions
     * @param content
     */
    private getSections(content: string): string[][] {
        let splitLines = content.split("\n");

        let sections: string[][] = [];
        let currentArray: string[] = [];
        for (let i = 0; i < splitLines.length; i++) {

            let curEl = splitLines[i];

            if (curEl.contains("# ")) {
                if (currentArray.length)
                    sections.push(currentArray)
                currentArray = [];
            }
            if(curEl.trim().length !== 0){
                currentArray.push(curEl.trim())
            }
        }
        sections.push(currentArray)

        return sections;
    }

    /**
     * Returns random int from 0 to max
     * @param max int top border
     * @private
     */
    private getRandomInt(max: number): number {
        return Math.floor(Math.random() * max);
    }

    /**
     * Create array of random questions
     * @param section questions section
     * @param numOfQuestions number of generated questions
     * @private
     */
    private generateRandomQuestionsFromSection(section: string[], numOfQuestions: number): string[] {
        section.shift();
        if (numOfQuestions >= section.length)
            return section;
        if (numOfQuestions === 0)
            return [];

        let result = [];

        for (let i = 0; i < numOfQuestions; i++) {
            let question = this.getRandomQuestion(section);
            section.remove(question);
            result.push(question);
        }

        return result;
    }

    /**
     * Returns random question from array
     * @param questions question array
     * @private
     */
    private getRandomQuestion(questions: string[]): string {
        let randomNumber = this.getRandomInt(questions.length);
        return questions[randomNumber];
    }

    /**
     * Prepare settings for using
     * @private
     */
    private parseQuestionsTemplate(): Map<number, number> {
        let result: Map<number, number> = new Map<number, number>();

        if (!this.settings.questionsTemplate)
            return result;

        let splitedSettings = this.settings.questionsTemplate.split(';');
        splitedSettings.map(x => {
            let splitedValues = x.split('-');
            let sectionNumber = splitedValues[0];
            let numberOfQuestions = splitedValues[1];

            result.set(Number(sectionNumber), Number(numberOfQuestions));
        })

        return result;
    }

    private getFancyDate(): string {
        let date = new Date();
        let fancyDate = `${date.getDay() + 1}-${date.getMonth() + 1}-${date.getFullYear()}`
        return fancyDate;
    }
}

class SettingTab
    extends PluginSettingTab {
    plugin: RandomStructuralDiaryPlugin;

    constructor(app: App, plugin: RandomStructuralDiaryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for RandomStructuralDiary plugin.'});

        new Setting(containerEl)
            .setName("File with questions to open")
            .setDesc("With file extension!")
            .addText(cb => {
                new FileSuggest(this.app, cb.inputEl);
                cb
                    .setPlaceholder("Directory/file.md")
                    .setValue(this.plugin.settings.fileWithQuestions)
                    .onChange(async (value) => {
                        this.plugin.settings.fileWithQuestions = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Global number of questions')
            .setDesc('Picks that number of questions from the whole questions file')
            .addText(text => text
                .setPlaceholder('Example: 5')
                .setValue(this.plugin.settings.globalNumberOfQuestions.toString())
                .onChange(async (new_template) => {
                    this.plugin.settings.globalNumberOfQuestions = +new_template;
                    await this.plugin.saveSettings();
                }))
            .setDisabled(this.plugin.settings.useAdvancedTemplate);

        new Setting(containerEl)
            .setName('Use advanced template')
            .setDesc('Allows you to setup template in old fashion way')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.useAdvancedTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.useAdvancedTemplate = value
                        await this.plugin.saveSettings();
                        await this.display();
                    }));

        new Setting(containerEl)
            .setName('Questions Template')
            .setDesc('Format: section1-numberOfQuestions;section1-numberOfQuestions; 1-3;2-2;...\n If section not specified picks random number of questions')
            .addText(text => text
                .setPlaceholder('Example: 1-3;2-2;')
                .setValue(this.plugin.settings.questionsTemplate)
                .onChange(async (new_template) => {
                    this.plugin.settings.questionsTemplate = new_template;
                    await this.plugin.saveSettings();
                }))
            .setDisabled(!this.plugin.settings.useAdvancedTemplate);

        new Setting(containerEl)
            .setName('Show headers')
            .setDesc('Show header for generated groups. Option available only for advanced template.')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.showHeaders)
                    .onChange(async (value) => {
                        this.plugin.settings.showHeaders = value
                        await this.plugin.saveSettings();
                    }))
            .setDisabled(!this.plugin.settings.useAdvancedTemplate);
    }
}

const DEFAULT_QUESTIONS =
    "# Remembering important events\n" +
    "\n" +
    "What important things happened  today?\n" +
    "\n" +
    "What places did I visit?\n" +
    "\n" +
    "With whom did I meet/speak?\n" +
    "\n" +
    "What was the topic of conversations?\n" +
    "\n" +
    "What did I purchase?\n" +
    "\n" +
    "What important did I do, start to do, accomplished?\n" +
    "\n" +
    "# Introspection (To sum up every project/day/week/month/year)\n" +
    "\n" +
    "What was successful or unsuccessful?\n" +
    "\n" +
    "Why?\n" +
    "\n" +
    "What could be done in more simple, easy and efficient way?\n" +
    "\n" +
    "What things weren't accomplished?\n" +
    "\n" +
    "What did hinder me?\n" +
    "\n" +
    "# Rationality\n" +
    "\n" +
    "Did I think thoroughly before speak/act? Did I weight consequences?\n" +
    "\n" +
    "What were wrong or irrational in my actions, words, thoughts?\n" +
    "\n" +
    "What would be the better way?\n" +
    "\n" +
    "What was the reason for my misstep?\n" +
    "\n" +
    "What should I do in order to not repeat my mistake?\n" +
    "\n" +
    "# Patterns\n" +
    "\n" +
    "What are my most common failures?\n" +
    "\n" +
    "What virtues were forgotten?\n" +
    "\n" +
    "What responsibilities are neglected?\n" +
    "\n" +
    "# Time-managment\n" +
    "\n" +
    "Did I spend time efficiently?\n" +
    "\n" +
    "What was time wasting?\n" +
    "\n" +
    "How can I optimise my day?\n" +
    "\n" +
    "What resources do I have?\n" +
    "\n" +
    "Am I using them effectively?\n" +
    "\n" +
    "Did I procrastinate?\n" +
    "\n" +
    "# Future\n" +
    "\n" +
    "Are there potential areas of crisis in my life?\n" +
    "\n" +
    "What am I doing to prepare?\n" +
    "\n" +
    "Is there opportunities for future development?\n" +
    "\n" +
    "# Emotions\n" +
    "\n" +
    "Did I keep peaceful spirit (Inner peace)?\n" +
    "\n" +
    "What is the most frequent topic of my thoughts?\n" +
    "\n" +
    "What thoughts are troubling me?\n" +
    "\n" +
    "What is the source of bad feelings?\n" +
    "\n" +
    "Are there any fearful, worrisome, upsetting things?\n" +
    "\n" +
    "Do I feel guilty, angry, offended, unsure?\n" +
    "\n" +
    "Why do I feel this way?\n" +
    "\n" +
    "What was the source of joy and pleasure for me recently?\n" +
    "\n" +
    "Why?\n" +
    "\n" +
    "# Intuition\n" +
    "\n" +
    "Do I have the feeling that something is wrong?\n" +
    "\n" +
    "Do I have the feeling that I missed something?\n" +
    "\n" +
    "Did I have an impulse to do something?\n" +
    "\n" +
    "What are opportunities for me in these circumstances to serve God and neighbors?\n" +
    "\n" +
    "Did I saw in a dream something meaningful?\n" +
    "\n" +
    "# Self-actualization\n" +
    "\n" +
    "What are my priorities for this period of life?\n" +
    "\n" +
    "What are my values?\n" +
    "\n" +
    "What are my dreams?\n" +
    "\n" +
    "What is my weakest point in character, knowledge, skills, habits?\n" +
    "\n" +
    "What is my strongest point?\n" +
    "\n" +
    "What makes me happy and gratified?\n" +
    "\n" +
    "# Intellectual life\n" +
    "\n" +
    "All ideas, aha reactions, eurekas, observations go here.\n" +
    "\n" +
    "What books/articles have I started to read or have finished to read?\n" +
    "\n" +
    "What texts am I working on?\n" +
    "\n" +
    "What have l finished?\n" +
    "\n" +
    "In what conferences and meetings did I participate?\n" +
    "\n" +
    "What movies have I watched?\n" +
    "\n" +
    "What new information have I discovered from books or conversations?\n" +
    "\n" +
    "What information needs to be checked?\n" +
    "\n" +
    "What topics do I need to consider more carefully and in depth?\n" +
    "\n" +
    "What facts are against my point of view?\n" +
    "\n" +
    "Is there reasonable doubt?\n" +
    "\n" +
    "# Social life\n" +
    "\n" +
    "Did I practice mindful listening?\n" +
    "\n" +
    "What new information have I found out about my acquaintance and friends?\n" +
    "\n" +
    "What are their dreams, problems, virtues, prayer needs?\n" +
    "\n" +
    "How can I participate in their life?\n" +
    "\n" +
    "Was I thankful?\n" +
    "\n" +
    "# Prayers\n" +
    "\n" +
    "What are my confessions to God?\n" +
    "\n" +
    "gratitudes to God?\n" +
    "\n" +
    "asking to God?\n" +
    "\n" +
    "What answers have I received?"
