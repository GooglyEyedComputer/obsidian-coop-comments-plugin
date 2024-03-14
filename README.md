# obsidian-coop-comments-plugin
A plugin for Obsidian that adds comments. Inspired by the comment systems in google docs and word, this plugin is made to allow multiple people to work on and comment in the same vault with any kind of syncronization. The plugin offers persistant profiles that gets shown on the comments. The profile used to comment is identified through a simple "password". Using this password will allow you to comment from the same profile no matter what devicec you are on, given you know the password. [See it in action](README.md#videos)

Thank you to [Fevol](https://github.com/Fevol) for being a big help and for his project [obsidian-criticmarkup](https://github.com/Fevol/obsidian-criticmarkup), which has been a great reference. 

Another reference has been [obsidian-comments-plugin](https://github.com/Darakah/obsidian-comments-plugin), thanks!

> [!NOTE]
> This is just the first prototype of the plugin. As it is my first ever Obsidian plugin I have so many ideas for improvement. And I think the first step is a complete architectural rework.
> - I also want to work on options for being able to choose where things are saved. Right now it is a hybrid between saving a lot of info in a single file and marking the text files seperately. I want to implement options for saving purely in a seperate file, but also an option for saving purely in the text files to preserve the spirit of pure-text note taking.

## Features:
- Commenting
  - Right click to insert comment on selection.
  - Comments are highlighted with profile colors. They are marked by |id|...|| in the text file. (for now
  - Comments saved in a json file in the root of the vault. (for now)
  - CTRL+Click to center the commented text.
- Comment view
  - List of all comments on in the current file.
  - Reply to comments.
  - Edit and remove comments.
  - CTRL+Click to center the commented text in the editor view.
- Persistant profiles
  - Retrieve and use profile based on simple string identifier. Use the same comment profile across different devices!
  - Edit the name and color shown in the profiles comments.

## Videos:

### Here are the comments in action!

https://github.com/olivervejen/ObsidianCommentsPlugin/assets/9892968/e3c31da9-5361-4101-a33a-11fa138a752b


### Make a new profile, or retrieve an existing one!

https://github.com/olivervejen/obsidian-coop-comments-plugin/assets/9892968/f1b0ea46-ce55-4b58-913e-eeb0b2b3b45f


### The settings panel will also allow you to change and edit profile details, as well as some client-side rendering options. More to come!
![Obsidian_beGWI21jL5](https://github.com/olivervejen/ObsidianCommentsPlugin/assets/9892968/b79310bf-0c99-4797-be4c-f4b3eddf3da2)
