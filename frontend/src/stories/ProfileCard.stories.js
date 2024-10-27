import React from 'react';
import { ProfileCard } from '../components/ProfileCard';
import avatar from '../resource/avatar.jpg';
import { ReactComponent as Github} from '../resource/github.svg';
import { ReactComponent as Linkedin} from '../resource/linkedin.svg';
import { ReactComponent as Twitter} from '../resource/twitter.svg';

export default {
    component: ProfileCard,
    title: 'ProfileCard',
};

const Template = args => <ProfileCard {...args} />;

export const Default = Template.bind({});
Default.args = {
    avatar: avatar,
    nickname: "mrsmith",
    overview: "Welcom to my blog. open source, Rust, I am a programmer who is interested in microelectronics, computer sience, various translators.",
    social: [
        <Twitter fill="#ABABAB"/>,
        <Github fill="#ABABAB"/>,
        <Linkedin fill="#ABABAB"/>,
    ],
};


