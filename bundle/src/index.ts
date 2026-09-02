/* The combined bundle: every card in this repo, registered from one file.
 *
 * HACS auto-registers exactly one Lovelace resource per repository, so this
 * is the file it points at — installing the repo makes all nine cards
 * available with no manual resource entries. Each card's own single-file
 * build is published alongside it for anyone who wants just one.
 *
 * Importing a card's entry module is enough: every card module defines its
 * custom element and pushes to `window.customCards` as a side effect, and
 * each one imports its own editor. Order is alphabetical purely for
 * readability — the cards are independent and none observes another.
 */
import "../../activity-heatmap/src/activity-heatmap-card";
import "../../body-stats/src/body-stats-card";
import "../../garage-control/src/garage-auto-open-card";
import "../../geyser-control/src/geyser-status-card";
import "../../gym-tracker/src/gym-tracker-card";
import "../../irrigation-control/src/irrigation-schedule-card";
import "../../pc-control/src/pc-overview-card";
import "../../quick-toggles/src/quick-toggles-card";
import "../../schedule-timeline-card/src/schedule-timeline-card";
