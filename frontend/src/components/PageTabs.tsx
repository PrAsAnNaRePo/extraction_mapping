import React, { useRef, useEffect, useState } from 'react';

interface PageTabsProps {
    pages: number[];
    currentPage: number;
    onPageChange: (page: number) => void;
}

const PageTabs: React.FC<PageTabsProps> = ({ pages, currentPage, onPageChange }) => {
    const [showLeftScroll, setShowLeftScroll] = useState(false);
    const [showRightScroll, setShowRightScroll] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);

    const checkScroll = () => {
        if (tabsRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
            setShowLeftScroll(scrollLeft > 0);
            setShowRightScroll(scrollLeft < scrollWidth - clientWidth);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [pages]);

    const scroll = (direction: 'left' | 'right') => {
        if (tabsRef.current) {
            const scrollAmount = direction === 'left' ? -200 : 200;
            tabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    // Ensure current tab is visible
    useEffect(() => {
        if (tabsRef.current) {
            const currentTab = tabsRef.current.querySelector(`[data-page="${currentPage}"]`);
            if (currentTab) {
                currentTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        }
    }, [currentPage]);

    return (
        <div className="relative flex items-center max-w-full">
            {/* Left Scroll Button */}
            {showLeftScroll && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 z-10 h-full px-2 bg-gradient-to-r from-white via-white to-transparent"
                >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Tabs Container */}
            <div
                ref={tabsRef}
                className="flex overflow-x-auto scrollbar-hide space-x-1 px-1 py-2"
                onScroll={checkScroll}
            >
                {pages.map((page) => (
                    <button
                        key={page}
                        data-page={page}
                        onClick={() => onPageChange(page)}
                        className={`
                            flex-shrink-0 px-4 py-2 rounded-md text-sm font-medium
                            transition-colors duration-200
                            ${currentPage === page
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                        `}
                    >
                        Page {page}
                    </button>
                ))}
            </div>

            {/* Right Scroll Button */}
            {showRightScroll && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 z-10 h-full px-2 bg-gradient-to-l from-white via-white to-transparent"
                >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default PageTabs;