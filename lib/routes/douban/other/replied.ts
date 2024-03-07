import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';

export default async (ctx) => {
    const currentUrl = `https://www.douban.com/people/${ctx.req.param('uid')}/notes`;
    const response = await got({
        method: 'get',
        url: currentUrl,
    });

    const $ = load(response.data);
    const list = $('div.recent-replied-mod ul.comment-list li')
        .map((_, item) => {
            item = $(item);
            const p = item.find('p');
            const nid = p
                .find('a')
                .attr('href')
                .match(/%2Fnote%2F(.*?)%2F&type=note/)[1];
            const title = p.find('a').text();
            p.remove();

            return {
                title: `${item.find('a.lnk-people').text()} - ${title}`,
                link: `https://www.douban.com/note/${nid}`,
            };
        })
        .get();

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                try {
                    const detailResponse = await got({
                        method: 'get',
                        url: item.link,
                    });
                    const match = detailResponse.data.match(/'comments':(.*)}],/);

                    if (match.length > 1) {
                        const content = load(detailResponse.data);
                        const title = `${content('a.note-author').text()} - ${content('h1').text()}`;

                        const comments = JSON.parse(match[1] + '}]');

                        let latest = new Date(0),
                            description,
                            pubDate,
                            author;

                        for (const c of comments) {
                            if (c.author.uid === ctx.req.param('uid') && new Date(c.create_time) > new Date(latest)) {
                                latest = new Date(c.create_time + ' GMT+8');
                                pubDate = latest.toUTCString();
                                description = c.text;
                                author = c.author.name;
                            } else if (c.replies.length > 0) {
                                comments.push(...c.replies);
                            }
                        }

                        return {
                            title,
                            description,
                            pubDate,
                            author,
                            link: item.link,
                        };
                    }
                    throw new Error('No comments');
                } catch {
                    return {
                        title: item.title,
                        link: item.link,
                    };
                }
            })
        )
    );

    ctx.set('data', {
        title: $('title').text() + ' - 最新回应过',
        link: currentUrl,
        item: items,
    });
};
