import {
    Message,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageActionRowComponentBuilder,
    EmbedBuilder,
    TextChannel,
    InteractionCollector,
    ButtonInteraction,
} from "discord.js";
import { config } from "./miscellaneous/config";
import { AlarmType } from "./miscellaneous/types";
import { addAltBan } from "./data/bans";
import { train } from "./nlp";
import { NlpManager } from "node-nlp";

const BAN_BUTTON_ID = "ban_button";
const CONFIRM_BUTTON_ID = "confirm_button";
const CANCEL_BUTTON_ID = "cancel_button";

function createAlarmEmbed(message: Message, suspectedAs: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor("Red")
        .setTitle("Alarming Account Detected")
        .setDescription(
            `${
                message.author.tag
            } is likely to be the alt account of ${suspectedAs}. This user has been flagged ${
                config.alarmFlagCount
            } times with a confidence of over ${
                config.confidenceThreshold * 100
            }%.`
        );
}

function createSilentAlarmEmbed(
    message: Message,
    intent: string
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor("Orange")
        .setTitle("Suspicious User Detected")
        .setDescription(
            `${
                message.author.tag
            } is suspected to be the alt account of ${intent}. This user has been flagged ${
                config.silentFlagCount
            } times with a confidence of over ${
                config.confidenceThreshold * 100
            }%.`
        );
}

function getAlarmChannel(message: Message): TextChannel {
    const alarmChannel = message.guild?.channels.cache.get(
        config.alarmChannelId
    );

    if (!alarmChannel?.isTextBased())
        throw new Error("Provided alarm channel ID is not a text channel.");

    return alarmChannel as TextChannel;
}

function createButton(
    style: ButtonStyle,
    label: string,
    id: string
): ButtonBuilder {
    return new ButtonBuilder().setStyle(style).setLabel(label).setCustomId(id);
}

export async function sendAlarmEmbed(
    manager: NlpManager,
    message: Message,
    suspectedAs: string,
    type: AlarmType
) {
    const alarmChannel = getAlarmChannel(message);
    const embed =
        type === AlarmType.Alarm
            ? createAlarmEmbed(message, suspectedAs)
            : createSilentAlarmEmbed(message, suspectedAs);

    const banButton = createButton(
        ButtonStyle.Danger,
        "Ban User",
        BAN_BUTTON_ID
    );

    const banRow =
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            banButton
        );

    const alarmMessage = await alarmChannel.send({
        content: type === AlarmType.Alarm ? "@everyone" : undefined,
        embeds: [embed],
        components: [banRow],
    });

    const banButtonFilter = (interaction) =>
        interaction.customId === BAN_BUTTON_ID &&
        interaction.member.permissions.has("BanMembers");

    const collector = alarmMessage.createMessageComponentCollector({
        filter: banButtonFilter,
    }) as InteractionCollector<ButtonInteraction<"cached">>;

    handleBanButtonCollector(manager, message, collector, suspectedAs);
}

function handleBanButtonCollector(
    manager: NlpManager,
    originalMessage: Message,
    collector: InteractionCollector<ButtonInteraction<"cached">>,
    suspectedAs: string
) {
    collector.on("collect", async (interaction) => {
        if (interaction.customId !== BAN_BUTTON_ID) return;

        const confirmationEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("Confirmation Modal")
            .setDescription("Are you sure you want to proceed?");

        const confirmButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Success)
            .setLabel("Confirm")
            .setCustomId(CONFIRM_BUTTON_ID);

        const cancelButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Danger)
            .setLabel("Cancel")
            .setCustomId(CANCEL_BUTTON_ID);

        const confirmRow =
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                confirmButton,
                cancelButton
            );

        const confirmMessage = await interaction.reply({
            embeds: [confirmationEmbed],
            components: [confirmRow],
        });

        const confirmationFilter = (modalInteraction) =>
            modalInteraction.member.permissions.has("BanMembers");

        const confirmationCollector =
            confirmMessage.createMessageComponentCollector({
                filter: confirmationFilter,
            });

        confirmationCollector.on("collect", async (modalInteraction) => {
            if (modalInteraction.customId === CONFIRM_BUTTON_ID) {
                await originalMessage.member?.ban({
                    reason: `The alt account of '${suspectedAs}'.`,
                });

                await addAltBan(suspectedAs, originalMessage.author.tag);
                await train(manager, originalMessage.client);

                modalInteraction.reply(
                    `${originalMessage.author.tag} has been banned and marked as the alt account of ${suspectedAs}. Now retraining on this data. (executed by <@!${modalInteraction.user.id}>)`
                );
            } else if (modalInteraction.customId === CANCEL_BUTTON_ID) {
                modalInteraction.reply("Successfully cancelled.");
            }
        });
    });
}
