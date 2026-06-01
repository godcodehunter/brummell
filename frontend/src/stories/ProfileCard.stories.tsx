import { ProfileCard } from '../components/ProfileCard';
import avatar from '../assets/avatar.jpg';

export default {
    title: 'ProfileCard',
    component: ProfileCard,
};

const OVERVIEW = [
    "Welcom to my blog. open source, Rust,",
    "I am a programmer who is interested in",
    "microelectronics, computer sience,",
    "various translators.",
].join(" ");

export const Default = {
    args: {
        avatar: avatar,
        nickname: "mrsmith",
        overview: OVERVIEW,
        social: [],
    },
};
