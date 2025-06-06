const state = require('../../utils/state');
const { noPermissionEmbed } = require('../../utils/embeds');
const config = require('config');
const { MessageFlags } = require('discord.js');

module.exports = {
  async execute(interaction) {
    const memberRoles = interaction.member.roles.cache.map((role) => role.name);
    const hasPermission = memberRoles.some((role) =>
      config.get('allowed_roles').includes(role)
    );

    if(!hasPermission)
      return await interaction.reply({
        embeds: [noPermissionEmbed],
        flags: MessageFlags.Ephemeral,
      });

    if(state.meetings.length === 0)
      return await interaction.reply({
        content: ':x: No meetings found',
        flags: MessageFlags.Ephemeral,
      });

    await interaction.reply(':arrow_down: Meetings list');
    const message = await interaction.fetchReply();

    const thread = await message.startThread({ name: 'Meetings list' });

    const formattedMeetings = state.meetings.map((meeting) => {
      const name = meeting.name.padEnd(20, ' ');
      const recorded = meeting.recorded ? '+' : '-';
      const transcribed = meeting.transcribed ? '+' : '-';
      const summarized = meeting.summarized ? '+' : '-';
      return ` ${name} | ${recorded.padEnd(8)} | ${transcribed.padEnd(11)} | ${summarized}`;
    });

    const messageText = `
 Meeting name         | Recorded | Transcribed | Summarized  
----------------------|----------|-------------|------------
${formattedMeetings.join('\n')}
`;

    const lines = messageText.split('\n');
    let chunk = '```';

    for(const line of lines) {
      if((chunk + '\n' + line + '```').length > 2000) {
        chunk += '```';
        await thread.send(chunk);
        chunk = '```\n' + line;
      } else {
        chunk += '\n' + line;
      }
    }

    chunk += '```';
    await thread.send(chunk);
  },
};
