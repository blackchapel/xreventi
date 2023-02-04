const Event = require('./../models/event.schema');
const User = require('./../models/user.schema');
const { sendEmail, cloudinary } = require('./../utilities/utils');
const fs = require('fs');

const createEvent = async (req, res) => {
    try {
        let fileUrl;
        if (req.file) {
            fileUrl = await cloudinary.uploader.upload(req.file.path, {
                public_id: req.user.id + '/event/thumbnail/' + req.file.filename
            });
            fs.unlinkSync(req.file.path);
        }
        let event = new Event({
            parent: {
                id: req.user.id,
                name: req.user.name,
                thumbnail: req.user.thumbnail
            },
            name: req.body.name,
            description: req.body.description,
            thumbnail: fileUrl.url,
            date: req.body.date,
            isSelection: req.body.isSelection,
            payment: {
                isPayment: req.body.isPayment,
                amount: req.body.isPayment ? req.body.amount : 0
            },
            approval: req.body.approval,
            status: 'PENDING',
            isPublished: false
        });

        await event.save();

        // Add event to parent club (eventsCreated)
        let eventCreatedObj = {
            id: req.user.id,
            name: req.user.name,
            thumbnail: req.user.thumbnail,
            status: 'PENDING',
            isApproved: false
        };
        await User.findByIdAndUpdate(
            req.user.id,
            { $push: { eventsCreated: eventCreatedObj } },
            { new: true }
        );

        // Add event to approval body (approvalsRequested)
        let approvalsArray = req.body.approval;
        for (const iterator of approvalsArray) {
            await User.findByIdAndUpdate(
                iterator.id,
                {
                    $push: { approvalsRequested: req.approval }
                },
                { new: true }
            );
        }

        // Send email to approval body

        for (const iterator of approvalsArray) {
            const approval = await User.findById(iterator.id);
            const approvalEmail = approval.email;
            const eventName = req.body.name;
            const clubName = req.user.name;
            const subject = 'New Approval Requested';
            const body = `Respected maam/sir, \n You have received a new approval request for the following: \n Event: ${eventName} \n Club: ${clubName}`;
            await sendEmail(approvalEmail, subject, body);
        }

        res.status(200).json({
            meesage: 'Event created successfully!',
            data: event
        });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

module.exports = { createEvent };