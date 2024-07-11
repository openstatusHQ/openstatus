"use client";

import { useState } from "react";
import { allPosts } from "contentlayer/generated";
import { Rss } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import {
    defaultMetadata,
    ogMetadata,
    twitterMetadata,
} from "@/app/shared-metadata";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";

export const metadata: Metadata = {
    ...defaultMetadata,
    title: "Blog",
    openGraph: {
        ...ogMetadata,
        title: "Blog | OpenStatus",
    },
    twitter: {
        ...twitterMetadata,
        title: "Blog | OpenStatus",
    },
};

export default function Post() {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedPosts = allPosts.sort(
        (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const totalPages = Math.ceil(sortedPosts.length / itemsPerPage);
    const paginatedPosts = sortedPosts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    return (
        <Shell>
            <Timeline
                title="Blog"
                description="All the latest articles and news from OpenStatus."
                actions={
                    <Button variant="outline" size="icon" asChild>
                        <a href="/blog/feed.xml" target="_blank" rel="noreferrer">
                            <Rss className="h-4 w-4" />
                            <span className="sr-only">RSS feed</span>
                        </a>
                    </Button>
                }
            >
                <div className="relative mb-4">
                    <div className="absolute top-0 right-0 flex space-x-2">
                        {currentPage > 1 && (
                            <Button onClick={handlePreviousPage}>Previous</Button>
                        )}
                        <span>
                            Page {currentPage} of {totalPages}
                        </span>
                        {currentPage < totalPages && (
                            <Button onClick={handleNextPage}>Next</Button>
                        )}
                    </div>
                </div>
                {paginatedPosts.map((post) => (
                    <Timeline.Article
                        key={post.slug}
                        publishedAt={post.publishedAt}
                        imageSrc={post.image}
                        title={post.title}
                        href={`./blog/${post.slug}`}
                    >
                        <div className="prose dark:prose-invert">
                            <p>{post.description}</p>
                        </div>
                        <div>
                            <Button variant="outline" className="rounded-full" asChild>
                                <Link href={`./blog/${post.slug}`}>Read more</Link>
                            </Button>
                        </div>
                    </Timeline.Article>
                ))}
                <div className="flex justify-end mt-4 space-x-2">
                    {currentPage > 1 && (
                        <Button onClick={handlePreviousPage}>Previous</Button>
                    )}
                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    {currentPage < totalPages && (
                        <Button onClick={handleNextPage}>Next</Button>
                    )}
                </div>
            </Timeline>
        </Shell>
    );
}
