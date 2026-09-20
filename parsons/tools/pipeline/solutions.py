"""Canonical solutions plus the metadata the pipeline cannot infer.

Everything else — chunk boundaries, indent depth, distractors — is derived
from the source by chunk.py / mutate.py.
"""

PROBLEMS = [
    dict(
        slug="contains-duplicate",
        title="Contains Duplicate",
        difficulty="Easy",
        pattern="set-membership",
        topics=["Array", "Hash Table"],
        lists=["blind75", "neetcode150"],
        statement="Given an integer array nums, return true if any value appears at least twice, and false if every element is distinct.",
        entry="containsDuplicate",
        hint="What do you need to know before you can call a value new?",
        invariant="seen holds exactly the values from nums[0..i-1].",
        src='''
def containsDuplicate(nums):
    seen = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False
''',
        tests=[
            ([[1, 2, 3, 1]], True),
            ([[1, 2, 3, 4]], False),
            ([[]], False),
            ([[7, 7]], True),
        ],
    ),
    dict(
        slug="valid-anagram",
        title="Valid Anagram",
        difficulty="Easy",
        pattern="hashmap-count",
        topics=["Hash Table", "String"],
        lists=["blind75", "neetcode150"],
        statement="Given two strings s and t, return true if t is an anagram of s.",
        entry="isAnagram",
        hint="What makes a letter in t impossible before you look at the rest?",
        invariant="count holds the unmatched letters of s after the first k letters of t.",
        src='''
def isAnagram(s, t):
    if len(s) != len(t):
        return False
    count = {}
    for ch in s:
        count[ch] = count.get(ch, 0) + 1
    for ch in t:
        if count.get(ch, 0) == 0:
            return False
        count[ch] -= 1
    return True
''',
        tests=[
            (["anagram", "nagaram"], True),
            (["rat", "car"], False),
            (["", ""], True),
            (["aa", "ab"], False),
        ],
    ),
    dict(
        slug="two-sum",
        title="Two Sum",
        difficulty="Easy",
        pattern="hashmap-index",
        topics=["Array", "Hash Table"],
        lists=["blind75", "neetcode150"],
        statement="Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target.",
        entry="twoSum",
        hint="At each number, what is the one value that would finish the pair?",
        invariant="seen maps every value before index i to its index.",
        src='''
def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []
''',
        tests=[
            ([[2, 7, 11, 15], 9], [0, 1]),
            ([[3, 2, 4], 6], [1, 2]),
            ([[3, 3], 6], [0, 1]),
        ],
    ),
    dict(
        slug="best-time-to-buy-and-sell-stock",
        title="Best Time to Buy and Sell Stock",
        difficulty="Easy",
        pattern="greedy-scan",
        topics=["Array", "Greedy"],
        lists=["blind75", "neetcode150"],
        statement="Given an array prices where prices[i] is the price on day i, return the maximum profit from a single buy and a later sell.",
        entry="maxProfit",
        hint="Which of the two must you update first for today's profit to be legal?",
        invariant="low is the cheapest price seen so far, including today.",
        src='''
def maxProfit(prices):
    best = 0
    low = prices[0]
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    return best
''',
        tests=[
            ([[7, 1, 5, 3, 6, 4]], 5),
            ([[7, 6, 4, 3, 1]], 0),
            ([[2]], 0),
        ],
    ),
    dict(
        slug="longest-substring-without-repeating-characters",
        title="Longest Substring Without Repeating Characters",
        difficulty="Medium",
        pattern="sliding-window-variable",
        topics=["Sliding Window", "Hash Table", "String"],
        lists=["blind75", "neetcode150"],
        statement="Given a string s, find the length of the longest substring without repeating characters.",
        entry="lengthOfLongestSubstring",
        hint="Before you measure the window, what must already be true about it?",
        invariant="seen holds exactly the characters of s[l..r] and they are all distinct.",
        src='''
def lengthOfLongestSubstring(s):
    res = 0
    l = 0
    seen = set()
    for r in range(len(s)):
        while s[r] in seen:
            seen.remove(s[l])
            l += 1
        seen.add(s[r])
        res = max(res, r - l + 1)
    return res
''',
        tests=[
            (["abcabcbb"], 3),
            (["bbbbb"], 1),
            (["pwwkew"], 3),
            ([""], 0),
            (["au"], 2),
        ],
        extra_distractors=[
            {"code": "if r - l + 1 > k:", "kind": "cross-pattern"},
        ],
    ),
    dict(
        slug="product-of-array-except-self",
        title="Product of Array Except Self",
        difficulty="Medium",
        pattern="prefix-suffix",
        topics=["Array"],
        lists=["blind75", "neetcode150"],
        statement="Given an integer array nums, return an array where answer[i] is the product of all elements of nums except nums[i], without using division.",
        entry="productExceptSelf",
        hint="At index i, which factors have you already folded in and which have not?",
        invariant="res[i] holds the product of everything strictly left of i.",
        src='''
def productExceptSelf(nums):
    res = [1] * len(nums)
    prefix = 1
    for i in range(len(nums)):
        res[i] = prefix
        prefix *= nums[i]
    suffix = 1
    for i in range(len(nums) - 1, -1, -1):
        res[i] *= suffix
        suffix *= nums[i]
    return res
''',
        tests=[
            ([[1, 2, 3, 4]], [24, 12, 8, 6]),
            ([[-1, 1, 0, -3, 3]], [0, 0, 9, 0, 0]),
        ],
    ),
    dict(
        slug="valid-palindrome",
        title="Valid Palindrome",
        difficulty="Easy",
        pattern="two-pointer-converge",
        topics=["Two Pointers", "String"],
        lists=["blind75", "neetcode150"],
        statement="Given a string s, return true if it is a palindrome after removing non-alphanumeric characters and ignoring case.",
        entry="isPalindrome",
        hint="What has to stay true about the two pointers for the comparison to mean anything?",
        invariant="clean[0..l-1] mirrors clean[r+1..end].",
        src='''
def isPalindrome(s):
    clean = [c.lower() for c in s if c.isalnum()]
    l = 0
    r = len(clean) - 1
    while l < r:
        if clean[l] != clean[r]:
            return False
        l += 1
        r -= 1
    return True
''',
        tests=[
            (["A man, a plan, a canal: Panama"], True),
            (["race a car"], False),
            ([" "], True),
        ],
    ),
    dict(
        slug="climbing-stairs",
        title="Climbing Stairs",
        difficulty="Easy",
        pattern="dp-1d-linear",
        topics=["Dynamic Programming", "Array"],
        lists=["blind75", "neetcode150"],
        statement="You are climbing a staircase of n steps, taking 1 or 2 steps at a time. In how many distinct ways can you reach the top?",
        entry="climbStairs",
        hint="How many previous answers does the next one actually depend on?",
        invariant="b is the number of ways to reach the current step, a the step before it.",
        src='''
def climbStairs(n):
    a = 1
    b = 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b
''',
        tests=[([2], 2), ([3], 3), ([5], 8), ([1], 1)],
    ),
    dict(
        slug="merge-intervals",
        title="Merge Intervals",
        difficulty="Medium",
        pattern="intervals-sort-merge",
        topics=["Array", "Sorting"],
        lists=["blind75", "neetcode150"],
        statement="Given an array of intervals, merge all overlapping intervals and return the non-overlapping intervals that cover all the input.",
        entry="merge",
        hint="What must be true about the order before overlap is only ever with the last one?",
        invariant="res is sorted and pairwise disjoint after each step.",
        src='''
def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    res = []
    for start, end in intervals:
        if res and start <= res[-1][1]:
            res[-1][1] = max(res[-1][1], end)
        else:
            res.append([start, end])
    return res
''',
        tests=[
            ([[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]),
            ([[[1, 4], [4, 5]]], [[1, 5]]),
        ],
    ),
    dict(
        slug="binary-search",
        title="Binary Search",
        difficulty="Easy",
        pattern="binary-search-index",
        topics=["Array", "Binary Search"],
        lists=["neetcode150"],
        statement="Given a sorted array of integers nums and an integer target, return the index of target, or -1 if it does not exist.",
        entry="search",
        hint="After a comparison, which half can you prove the answer is not in?",
        invariant="if target exists it lies in nums[lo..hi].",
        src='''
def search(nums, target):
    lo = 0
    hi = len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
''',
        tests=[
            ([[-1, 0, 3, 5, 9, 12], 9], 4),
            ([[-1, 0, 3, 5, 9, 12], 2], -1),
            ([[5], 5], 0),
        ],
    ),
]
