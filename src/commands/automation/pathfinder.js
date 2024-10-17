const { SlashCommandBuilder } = require("discord.js");
const { Embed } = require("../../classes/Embed");
const Movements = require("mineflayer-pathfinder").Movements;
const { GoalNear } = require("mineflayer-pathfinder").goals;
const { Vec3 } = require("vec3");

module.exports = {
  cooldown: 15,
  data: new SlashCommandBuilder()
    .setName("pathfinder")
    .setDescription("This command allows the bot to move towards specific coordinates within the Minecraft world.")
    .addStringOption((option) => option.setName("x").setDescription("The X coordinate.").setRequired(true))
    .addStringOption((option) => option.setName("y").setDescription("The Y coordinate.").setRequired(true))
    .addStringOption((option) => option.setName("z").setDescription("The Z coordinate.").setRequired(true)),
  
  async execute(interaction, bot) {
    const x = parseInt(interaction.options.getString("x"));
    const y = parseInt(interaction.options.getString("y"));
    const z = parseInt(interaction.options.getString("z"));

    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    await attemptPath(bot, interaction, x, y, z);

    const embed = new Embed(bot)
      .setTitle("Pathfinding initiated")
      .setFields({ name: "Current goal", value: `${x}, ${y}, ${z}` });
    await interaction.reply({ embeds: [embed] });
  },
};

async function attemptPath(bot, interaction, x, y, z) {
  bot.pathfinder.setGoal(new GoalNear(x, y, z, 1));
  bot.on("path_update", (path) => {
    if (path.status === "noPath") {
      handleObstacle(bot, interaction, x, y, z, 0);
    }
  });

  bot.once("goal_reached", async () => {
    const position = bot.entity.position;
    const roundedPos = { x: Math.round(position.x), y: Math.round(position.y), z: Math.round(position.z) };

    const embed = new Embed(bot)
      .setTitle("Pathfinding completed")
      .setFields({ name: "Current position", value: `${roundedPos.x}, ${roundedPos.y}, ${roundedPos.z}` });
    await interaction.followUp({ embeds: [embed] });
  });
}

async function handleObstacle(bot, interaction, goalX, goalY, goalZ, retryCount) {
  if (retryCount > 5) {
    await interaction.followUp(`Failed after ${retryCount} attempts. Goal unreachable.`);
    return;
  }

  const position = bot.entity.position;
  const targetBlock = bot.blockAt(new Vec3(goalX, goalY, goalZ));

  if (!targetBlock || !bot.canDigBlock(targetBlock)) {
    await collectMaterials(bot);
    await buildPath(bot, goalX, goalY, goalZ);
  }

  const embed = new Embed(bot)
    .setTitle("Pathfinding interrupted by obstacle")
    .setFields({ name: "Obstacle detected at", value: `${position.x}, ${position.y}, ${position.z}` });
  await interaction.followUp({ embeds: [embed] });

  bot.once("goal_reached", () => attemptPath(bot, interaction, goalX, goalY, goalZ));
  handleObstacle(bot, interaction, goalX, goalY, goalZ, retryCount + 1);
}

async function collectMaterials(bot) {
  const collectibleBlocks = ['dirt', 'stone', 'sand', 'gravel'];
  const nearbyBlocks = bot.findBlocks({
    matching: block => collectibleBlocks.includes(block.name),
    maxDistance: 32,
    count: 5
  });

  for (const blockPos of nearbyBlocks) {
    const block = bot.blockAt(blockPos);
    if (block && bot.canDigBlock(block)) {
      await bot.dig(block);
    }
  }
}

async function buildPath(bot, goalX, goalY, goalZ) {
  const currentPos = bot.entity.position;
  const blockToPlace = bot.inventory.items().find(item => item.name.includes('dirt') || item.name.includes('stone'));

  if (blockToPlace) {
    const positionsToPlace = [
      new Vec3(goalX, currentPos.y, goalZ), // Directly to goal
      new Vec3(currentPos.x, currentPos.y, currentPos.z + 1), // One block in front
      new Vec3(currentPos.x + 1, currentPos.y, currentPos.z), // One block to the right
      new Vec3(currentPos.x - 1, currentPos.y, currentPos.z), // One block to the left
      new Vec3(currentPos.x, currentPos.y, currentPos.z - 1), // One block behind
    ];

    for (const pos of positionsToPlace) {
      await bot.placeBlock(bot.blockAt(pos), new Vec3(0, 1, 0));
    }
  }

  bot.pathfinder.setGoal(new GoalNear(goalX, goalY, goalZ, 1));
}
