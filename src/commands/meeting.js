const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meeting')
    .setDescription('Manage meetings')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Starts a new meeting')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the meeting')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('Stops the current meeting')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('Lists all meetings')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Deletes a meeting')
        .addStringOption((option) =>
          option
            .setName('what')
            .setDescription('What to delete')
            .setRequired(true)
            .addChoices(
              { name: 'recording', value: 'recording' },
              { name: 'meeting', value: 'meeting' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the meeting')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const command = interaction.commandName;
    const subcommand = interaction.options.getSubcommand();
    const logicPath = path.join(
      __dirname,
      'logic',
      `${command}_${subcommand}.js`
    );

    if(fs.existsSync(logicPath))
      await require(logicPath).autocomplete(interaction);
    else await interaction.respond([]);
  },

  async execute(interaction) {
    const command = interaction.commandName;
    const subcommand = interaction.options.getSubcommand();
    const logicPath = path.join(
      __dirname,
      'logic',
      `${command}_${subcommand}.js`
    );

    if(fs.existsSync(logicPath)) await require(logicPath).execute(interaction);
    else
      await interaction.reply(`No logic found for subcommand: ${subcommand}`);
  },
};
