"use client";

import { useState } from "react";
import { Button } from "@openstatus/ui";
import { Mdx } from "@/components/content/mdx";
import { Timeline } from "@/components/content/timeline";
import { allChangelogs } from "contentlayer/generated";

export default function ChangelogClient() {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedChangelogs = allChangelogs.sort(
        (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const totalPages = Math.ceil(sortedChangelogs.length / itemsPerPage);
    const paginatedChangelogs = sortedChangelogs.slice(
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
        <Timeline
            title="Changelog"
            description="All the latest features, fixes and work to OpenStatus."
            actions={
                <Button variant="outline" size="icon" asChild>
                    <a href="/changelog/feed.xml" target="_blank" rel="noreferrer">
                        <span className="h-4 w-4">RSS</span>
                        <span className="sr-only">RSS feed</span>
                    </a>
                </Button>
            }
        >
            <div className="relative mb-4">
                <div className="absolute top-0 right-0 flex items-center space-x-2">
                    {currentPage > 1 && (
                        <Button onClick={handlePreviousPage}>
                            Previous
                        </Button>
                    )}
                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    {currentPage < totalPages && (
                        <Button onClick={handleNextPage}>
                            Next
                        </Button>
                    )}
                </div>
            </div>
            {paginatedChangelogs.map((changelog) => (
                <Timeline.Article
                    key={changelog.slug}
                    publishedAt={changelog.publishedAt}
                    imageSrc={changelog.image}
                    title={changelog.title}
                    href={`./changelog/${changelog.slug}`}
                >
                    <Mdx code={changelog.body.code} />
                </Timeline.Article>
            ))}
            <div className="flex justify-end items-center mt-4 space-x-2">
                {currentPage > 1 && (
                    <Button onClick={handlePreviousPage}>
                        Previous
                    </Button>
                )}
                <span>
                    Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages && (
                    <Button onClick={handleNextPage}>
                        Next
                    </Button>
                )}
            </div>
        </Timeline>
    );
}

