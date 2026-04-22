const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database('ExamDB');
const resultsContainer = database.container('results');
const examsContainer = database.container('exams');

app.http('getDetailedResults', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const studentId = request.query.get('studentId');
            const examId = request.query.get('examId');
            const teacherId = request.query.get('teacherId');

            let query;

            if (studentId && examId) {
                // Specific student + exam result
                query = {
                    query: 'SELECT * FROM c WHERE c.studentId = @studentId AND c.examId = @examId',
                    parameters: [
                        { name: '@studentId', value: studentId },
                        { name: '@examId', value: examId }
                    ]
                };
            } else if (studentId) {
                // All results for a student
                query = {
                    query: 'SELECT * FROM c WHERE c.studentId = @studentId ORDER BY c.submittedAt DESC',
                    parameters: [{ name: '@studentId', value: studentId }]
                };
            } else if (examId) {
                // All students for a specific exam (teacher view)
                query = {
                    query: 'SELECT * FROM c WHERE c.examId = @examId ORDER BY c.submittedAt DESC',
                    parameters: [{ name: '@examId', value: examId }]
                };
            } else if (teacherId) {
                // All results for all exams by teacher
                const examsQuery = {
                    query: 'SELECT c.id FROM c WHERE c.teacherId = @teacherId',
                    parameters: [{ name: '@teacherId', value: teacherId }]
                };
                const { resources: exams } = await examsContainer.items
                    .query(examsQuery).fetchAll();
                const examIds = exams.map(e => e.id);

                if (!examIds.length) {
                    return { status: 200, jsonBody: { results: [], stats: { total: 0, passed: 0, failed: 0, avgScore: 0 } } };
                }

                const { resources: results } = await resultsContainer.items
                    .query('SELECT * FROM c ORDER BY c.submittedAt DESC')
                    .fetchAll();

                const filtered = results.filter(r => examIds.includes(r.examId));
                const stats = computeStats(filtered);
                return { status: 200, jsonBody: { results: filtered, stats } };
            } else {
                return { status: 400, jsonBody: { error: 'Provide studentId, examId, or teacherId' } };
            }

            const { resources: results } = await resultsContainer.items
                .query(query).fetchAll();

            const stats = computeStats(results);
            return { status: 200, jsonBody: { results, stats } };

        } catch (error) {
            return { status: 500, jsonBody: { error: error.message } };
        }
    }
});

function computeStats(results) {
    if (!results.length) return { total: 0, passed: 0, failed: 0, avgScore: 0 };
    const passed = results.filter(r => r.passed).length;
    const avgScore = Math.round(results.reduce((a, r) => a + r.percentage, 0) / results.length);
    return {
        total: results.length,
        passed,
        failed: results.length - passed,
        avgScore,
        passRate: Math.round((passed / results.length) * 100)
    };
}
