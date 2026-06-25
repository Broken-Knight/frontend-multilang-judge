import type { Problem } from '../types';

export const problems: Problem[] = [
  {
    id: 'sum-two-numbers',
    title: '两数之和输出',
    difficulty: '入门',
    description: '读取一行中的两个整数，输出它们的和。',
    inputDescription: '输入包含两个整数 a 和 b，用空格或换行分隔。',
    outputDescription: '输出一个整数，表示 a + b 的结果。',
    samples: [
      {
        name: '样例 1',
        stdin: '3 5',
        expectedStdout: '8',
      },
    ],
    starterCode: `import sys

nums = list(map(int, sys.stdin.read().split()))
print(nums[0] + nums[1])
`,
    testCases: [
      { name: '正整数', stdin: '3 5', expectedStdout: '8' },
      { name: '含负数', stdin: '-4 9', expectedStdout: '5' },
      { name: '大整数', stdin: '123456 654321', expectedStdout: '777777' },
    ],
  },
  {
    id: 'max-in-sequence',
    title: '序列最大值',
    difficulty: '基础',
    description: '第一行给出整数 n，第二行给出 n 个整数，输出其中最大的数。',
    inputDescription: '第一行是 n；第二行是 n 个整数。',
    outputDescription: '输出序列中的最大值。',
    samples: [
      {
        name: '样例 1',
        stdin: '5\n2 9 -1 4 7',
        expectedStdout: '9',
      },
    ],
    starterCode: `n = int(input())
nums = list(map(int, input().split()))

answer = nums[0]
for value in nums[:n]:
    if value > answer:
        answer = value

print(answer)
`,
    testCases: [
      { name: '普通序列', stdin: '5\n2 9 -1 4 7', expectedStdout: '9' },
      { name: '全部负数', stdin: '4\n-8 -3 -19 -5', expectedStdout: '-3' },
      { name: '单个元素', stdin: '1\n42', expectedStdout: '42' },
    ],
  },
  {
    id: 'fibonacci-number',
    title: '斐波那契数',
    difficulty: '进阶',
    description: '给定非负整数 n，输出第 n 个斐波那契数。规定 F(0)=0，F(1)=1。',
    inputDescription: '输入一个非负整数 n。',
    outputDescription: '输出 F(n)。',
    samples: [
      {
        name: '样例 1',
        stdin: '7',
        expectedStdout: '13',
      },
    ],
    starterCode: `def fib(n):
    if n < 2:
        return n

    prev, curr = 0, 1
    for _ in range(2, n + 1):
        prev, curr = curr, prev + curr
    return curr


n = int(input())
print(fib(n))
`,
    testCases: [
      { name: '零', stdin: '0', expectedStdout: '0' },
      { name: '样例', stdin: '7', expectedStdout: '13' },
      { name: '较大输入', stdin: '20', expectedStdout: '6765' },
    ],
  },
];
