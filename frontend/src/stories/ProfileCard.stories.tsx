import { ProfileCard } from '../components/ProfileCard';
import avatar from '../assets/avatar.jpg';
import { ReactComponent as Github } from '../assets/github.svg';
import { ReactComponent as Linkedin } from '../assets/linkedin.svg';
import { ReactComponent as Twitter } from '../assets/twitter.svg';

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
        social: [
            <Twitter fill="#ABABAB" />,
            <Github fill="#ABABAB" />,
            <Linkedin fill="#ABABAB" />,
        ],
    },
};
