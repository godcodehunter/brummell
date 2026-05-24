import { DateTime, Duration } from 'luxon';

function getCalendarFormat(myDateTime: DateTime, now: DateTime): string {
    var diff = myDateTime.diff(now.startOf("day"), 'days').as('days');
    return diff < -6 ? 'sameElse' :
        diff < -1 ? 'lastWeek' :
            diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                        diff < 7 ? 'nextWeek' : 'sameElse';
};

export function stringifyTime(timestamp: DateTime) {
    const ts = timestamp.toLocal();
    const cur = DateTime.local();
    const human_readable = getCalendarFormat(ts, cur);

    if (human_readable === "sameDay") {
        return `today at ${ts.toFormat("T")}`;
    }
    if (human_readable === "lastDay") {
        return `yesterday at ${ts.toFormat("T")}`;
    }

    return ts.toFormat("DD T");
};

export function stringifyDuration(duration: Duration): string {
    const dur = duration.shiftTo('hours', 'minutes');
    let ret: string = "";
    [[dur.hours, "h"], [dur.minutes, "min"]].map((i) => {
        if (i[0] !== 0) {
            if (ret.length > 0) {
                ret += " ";
            }
            ret += `${i[0]} ${i[1]}`;
        }
    });
    return ret += " read";
};