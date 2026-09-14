import { Channel } from '../types/live';

let channels: Channel[] = [];
let currentIndex = -1;

export function setZappingChannels(
newChannels: Channel[],
selectedStreamId: number
) {
channels = newChannels;

currentIndex = channels.findIndex(
(channel) =>
channel.stream_id === selectedStreamId
);
}

export function getCurrentZappingIndex() {
return currentIndex;
}

export function getZappingChannels() {
return channels;
}

export function getPreviousChannel(): Channel | null {
if (
channels.length === 0 ||
currentIndex <= 0
) {
return null;
}

currentIndex -= 1;

return channels[currentIndex];
}

export function getNextChannel(): Channel | null {
if (
channels.length === 0 ||
currentIndex >= channels.length - 1
) {
return null;
}

currentIndex += 1;

return channels[currentIndex];
}